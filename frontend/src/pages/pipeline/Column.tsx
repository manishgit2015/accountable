import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { useState } from "react";

import type { Deal } from "../../api/types";
import { closedThisMonth, type StageInfo } from "../../lib/deals";
import { formatMoneyShort } from "../../lib/format";
import { ClosedRow } from "./ClosedRow";
import { DealCard } from "./DealCard";

/** Won and Lost list the 5 most recent, with "N more · Show all" (R60). */
export const CLOSED_LIMIT = 5;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * The deals a column holds, in board order (R60, R63). Open columns: every deal at the stage, by
 * position. Won and Lost: only deals closed this calendar month (by closed_at), most recent first.
 */
export function columnDeals(stage: StageInfo, deals: Deal[], now: Date = new Date()): Deal[] {
  const inStage = deals.filter((d) => d.stage === stage.key);
  if (stage.open) return inStage.sort((a, b) => a.position - b.position || a.id - b.id);
  return inStage
    .filter((d) => closedThisMonth(d, now))
    .sort((a, b) => (b.closedAt ?? "").localeCompare(a.closedAt ?? "") || b.id - a.id);
}

/** A column's header figures: count, total value and expected revenue of the deals it holds (R60). */
export function columnTotals(members: Deal[]): { count: number; value: number; expected: number } {
  return {
    count: members.length,
    value: members.reduce((sum, d) => sum + d.value, 0),
    expected: members.reduce((sum, d) => sum + d.expectedRevenue, 0),
  };
}

export function columnId(stage: string): string {
  return `column:${stage}`;
}

interface ColumnProps {
  stage: StageInfo;
  /** All the board's deals; the column picks its own (R60). */
  deals: Deal[];
  /** While a card is dragged over this column: where the dashed drop gap goes, among the other cards. */
  dropIndex?: number | null;
  /** The deal being dragged. Its card stays, faded, while the lifted copy follows the pointer. */
  activeId?: number | null;
  onAddDeal?: (stage: StageInfo) => void;
  onOpenDeal: (deal: Deal) => void;
  now?: Date;
}

/** One board column: header with totals, "Add deal" on open stages, and its cards or rows. */
export function Column({ stage, deals, dropIndex = null, activeId = null, onAddDeal, onOpenDeal, now }: ColumnProps) {
  const [showAll, setShowAll] = useState(false);
  const members = columnDeals(stage, deals, now);
  const totals = columnTotals(members);
  const ordered = members;
  const hidden = stage.open || showAll ? 0 : Math.max(0, ordered.length - CLOSED_LIMIT);
  const visible = hidden > 0 ? ordered.slice(0, CLOSED_LIMIT) : ordered;
  const { setNodeRef, isOver } = useDroppable({ id: columnId(stage.key), data: { stage: stage.key } });
  const month = MONTH_NAMES[(now ?? new Date()).getMonth()];

  return (
    <section
      className={stage.open ? "board-column" : "board-column closed-column"}
      aria-label={`${stage.label} column`}
      data-stage={stage.key}
    >
      <div className="col-head">
        <span className="dot" style={{ background: stage.color }} aria-hidden="true" />
        <span className="name">{stage.label}</span>
        <span className="count" aria-label={`${totals.count} deals`}>
          {totals.count}
        </span>
        <span className="val">
          <span className="num" data-testid="column-value">
            {formatMoneyShort(totals.value)}
          </span>
          <span className="e">
            {stage.open ? (
              <>
                <span className="num" data-testid="column-expected">
                  {formatMoneyShort(totals.expected)}
                </span>{" "}
                expected
              </>
            ) : (
              "this month"
            )}
          </span>
        </span>
      </div>
      <div ref={setNodeRef} className={isOver ? "stack over" : "stack"}>
        {stage.open && onAddDeal && (
          <button type="button" className="add" onClick={() => onAddDeal(stage)}>
            <Plus size={16} aria-hidden="true" />
            Add deal
          </button>
        )}
        {withGap(visible, activeId, dropIndex).map((entry) =>
          entry === "gap" ? (
            // The drop gap: a dashed Sea Mist placeholder where the card will land (spec 3.9).
            <div key="gap" className={stage.open ? "drop" : "drop drop-closed"} aria-hidden="true" />
          ) : (
            <DraggableDeal
              key={entry.id}
              deal={entry}
              closed={!stage.open}
              dragging={entry.id === activeId}
              onOpen={onOpenDeal}
            />
          ),
        )}
        {!stage.open && hidden > 0 && (
          <button type="button" className="link-button show-all" onClick={() => setShowAll(true)}>
            {hidden} more · Show all
          </button>
        )}
        {!stage.open && showAll && ordered.length > CLOSED_LIMIT && (
          <button type="button" className="link-button show-all" onClick={() => setShowAll(false)}>
            Show the latest {CLOSED_LIMIT}
          </button>
        )}
        {!stage.open && <div className="month-note">Closed in {month}</div>}
      </div>
    </section>
  );
}

/** The cards in order, with the drop gap at `dropIndex` counted among the cards other than the dragged one. */
function withGap(cards: Deal[], activeId: number | null, dropIndex: number | null): (Deal | "gap")[] {
  if (dropIndex === null) return cards;
  const out: (Deal | "gap")[] = [];
  let others = 0;
  for (const card of cards) {
    if (card.id !== activeId) {
      if (others === dropIndex) out.push("gap");
      others += 1;
    }
    out.push(card);
  }
  if (!out.includes("gap")) out.push("gap");
  return out;
}

interface DraggableDealProps {
  deal: Deal;
  closed: boolean;
  dragging: boolean;
  onOpen: (deal: Deal) => void;
}

/** A card or row the board can drag, by pointer or keyboard (R63, R66). Clicking or Enter opens the deal. */
function DraggableDeal({ deal, closed, dragging, onOpen }: DraggableDealProps) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: deal.id, data: { stage: deal.stage } });
  return (
    <div
      ref={setNodeRef}
      className={dragging ? "draggable dragging" : "draggable"}
      data-board-card
      data-deal-id={deal.id}
      {...attributes}
      {...listeners}
      aria-roledescription="Draggable deal"
      aria-label={`${deal.name}, ${deal.organizationName ?? "no organization"}. Press Space to move it, or Enter to open it.`}
      onClick={() => onOpen(deal)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          onOpen(deal);
          return;
        }
        listeners?.onKeyDown?.(event);
      }}
    >
      {closed ? <ClosedRow deal={deal} /> : <DealCard deal={deal} />}
    </div>
  );
}
