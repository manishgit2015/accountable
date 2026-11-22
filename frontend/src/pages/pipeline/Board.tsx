import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type Active,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  type Over,
} from "@dnd-kit/core";
import { useEffect, useRef, useState } from "react";

import type { Deal, DealMove, Stage } from "../../api/types";
import { STAGES, closedThisMonth, stageInfo, type StageInfo } from "../../lib/deals";
import { ClosedRow } from "./ClosedRow";
import { Column, columnDeals } from "./Column";
import { DealCard } from "./DealCard";

interface Target {
  stage: Stage;
  /** The place among the column's other cards: 0 is the top. */
  index: number;
}

/**
 * Where a drop lands, as /move's neighbours (spec 5.4). `others` is the target column's cards in board
 * order without the dragged one. In an open column the neighbours are the cards either side of `index`.
 * Won and Lost list the most recent first, so a drop there goes to the top: the card below it is the
 * column's first by position, which keeps the server's neighbour check true.
 */
export function dropNeighbours(
  stage: StageInfo,
  others: number[],
  index: number,
  dealId: number,
  deals: Deal[],
  now: Date,
): Pick<DealMove, "beforeId" | "afterId"> {
  if (stage.open) return { beforeId: others[index - 1] ?? null, afterId: others[index] ?? null };
  const first = deals
    .filter((d) => d.id !== dealId && d.stage === stage.key && closedThisMonth(d, now))
    .sort((a, b) => a.position - b.position || a.id - b.id)[0];
  return { beforeId: null, afterId: first?.id ?? null };
}

function stageOf(over: Over | null): Stage | null {
  const stage = over?.data.current?.stage as Stage | undefined;
  return stage ?? null;
}

/**
 * The place under the dragged card: how many of the column's other cards have their middle above the
 * dragged card's middle. It reads the cards' live positions, so the gap it opens (which only moves the
 * cards below it) never changes the answer, and the board doesn't flicker.
 */
function placeIn(stage: Stage, active: Active): number {
  if (!stageInfo(stage).open) return 0;
  const rect = active.rect.current.translated;
  if (!rect) return 0;
  const middle = rect.top + rect.height / 2;
  const cards = document.querySelectorAll<HTMLElement>(`[data-stage="${stage}"] [data-board-card]`);
  return Array.from(cards).filter((el) => {
    if (el.dataset.dealId === String(active.id)) return false;
    const r = el.getBoundingClientRect();
    return r.top + r.height / 2 < middle;
  }).length;
}

/** A pointer drag uses the pointer; a keyboard drag has none, so it uses the lifted card's box. */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

/**
 * R66: the arrow keys move the lifted card a whole column left or right, or one card up or down,
 * rather than a few pixels at a time.
 */
const keyboardCoordinates: KeyboardCoordinateGetter = (event, { currentCoordinates, context }) => {
  const rect = context.active?.rect.current;
  const size = rect?.translated ?? rect?.initial;
  if (!size) return undefined;
  // The lifted card's box at the current coordinates.
  const box = { left: currentCoordinates.x, width: size.width, height: size.height };
  const step = box.height + 10;
  if (event.code === "ArrowDown") {
    event.preventDefault();
    return { ...currentCoordinates, y: currentCoordinates.y + step };
  }
  if (event.code === "ArrowUp") {
    event.preventDefault();
    return { ...currentCoordinates, y: currentCoordinates.y - step };
  }
  if (event.code !== "ArrowRight" && event.code !== "ArrowLeft") return undefined;
  event.preventDefault();
  const centre = box.left + box.width / 2;
  const columns = [...context.droppableRects.values()].sort((a, b) => a.left - b.left);
  const next =
    event.code === "ArrowRight"
      ? columns.find((r) => r.left + r.width / 2 > centre + 20)
      : [...columns].reverse().find((r) => r.left + r.width / 2 < centre - 20);
  if (!next) return currentCoordinates;
  return { x: next.left + (next.width - box.width) / 2, y: Math.max(currentCoordinates.y, next.top) };
};

interface BoardProps {
  deals: Deal[];
  onMove: (dealId: number, move: DealMove) => void;
  onAddDeal: (stage: StageInfo) => void;
  onOpenDeal: (deal: Deal) => void;
}

/** Six columns with drag and drop across and within them, by pointer or keyboard (R60, R63, R66). */
export function Board({ deals, onMove, onAddDeal, onOpenDeal }: BoardProps) {
  const now = new Date();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const sensors = useSensors(
    // A small movement before a drag starts, so a click still opens the deal.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // R66: Space lifts and drops, the arrow keys move, Escape cancels.
    useSensor(KeyboardSensor, {
      coordinateGetter: keyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );
  const active = activeId === null ? undefined : deals.find((d) => d.id === activeId);
  // NFR-7, R66: after a keyboard move the card is drawn again in its new place, which drops the focus.
  // Once the board shows it there, focus goes back to it, so the next key press still acts on the card.
  const refocus = useRef<{ id: number; stage: Stage; from: Deal } | null>(null);
  useEffect(() => {
    const wanted = refocus.current;
    if (!wanted) return;
    const deal = deals.find((d) => d.id === wanted.id);
    const moved =
      deal?.stage === wanted.stage && (deal.stage !== wanted.from.stage || deal.position !== wanted.from.position);
    if (!moved) return; // not drawn in its new place yet
    refocus.current = null;
    document.querySelector<HTMLElement>(`[data-board-card][data-deal-id="${wanted.id}"]`)?.focus();
  });

  function aim(event: DragMoveEvent) {
    const stage = stageOf(event.over);
    const next = stage ? { stage, index: placeIn(stage, event.active) } : null;
    // Only a real change re-renders, so moving within one place costs nothing.
    if (next?.stage !== target?.stage || next?.index !== target?.index) setTarget(next);
  }

  function reset() {
    setActiveId(null);
    setTarget(null);
  }

  function handleStart(event: DragStartEvent) {
    setActiveId(Number(event.active.id));
    setTarget(null);
  }

  function handleEnd(event: DragEndEvent) {
    const id = Number(event.active.id);
    const stage = stageOf(event.over);
    const place = stage ? { stage, index: placeIn(stage, event.active) } : target;
    reset();
    const deal = deals.find((d) => d.id === id);
    if (!place || !deal) return;
    const info = stageInfo(place.stage);
    const others = columnDeals(info, deals, now)
      .map((d) => d.id)
      .filter((x) => x !== id);
    if (place.stage === deal.stage) {
      // Same column: only a real change of place is a move. Won and Lost aren't reordered by hand.
      if (!info.open) return;
      const original = columnDeals(info, deals, now).findIndex((d) => d.id === id);
      if (original === place.index) return;
    }
    if (event.activatorEvent instanceof KeyboardEvent) {
      refocus.current = { id, stage: place.stage, from: deal };
    }
    onMove(id, { stage: place.stage, ...dropNeighbours(info, others, place.index, id, deals, now) });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={handleStart}
      onDragMove={aim}
      onDragOver={aim}
      onDragEnd={handleEnd}
      onDragCancel={reset}
    >
      <div className="board">
        {STAGES.map((stage) => (
          <Column
            key={stage.key}
            stage={stage}
            deals={deals}
            activeId={activeId}
            dropIndex={target?.stage === stage.key ? target.index : null}
            onAddDeal={onAddDeal}
            onOpenDeal={onOpenDeal}
            now={now}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {active ? (
          stageInfo(target?.stage ?? active.stage).open ? (
            <DealCard deal={active} lifted />
          ) : (
            <ClosedRow deal={active} lifted />
          )
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
