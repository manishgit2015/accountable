// The pipeline page: open totals and the stage strip (R61), opening and adding deals from the board (R62, R65),
// and moving a card with the keyboard (R63, R64, R66), including a refused move (REL-8, REL-11).
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Stage } from "../../api/types";
import { STAGES } from "../../lib/deals";
import { fakeApi, json, renderPage } from "../../test/app";
import { PipelinePage } from "./PipelinePage";

let nextId = 1;
function deal(stage: Stage, value: number, overrides: Record<string, unknown> = {}) {
  const id = nextId++;
  const probability = { new: 5, qualified: 20, proposal: 40, negotiation: 70, won: 100, lost: 0 }[stage];
  return {
    id,
    organization_id: 1,
    organization_name: "Acme Ltd",
    contact_id: 10,
    contact_name: "Ada Shah",
    name: `Deal ${id}`,
    stage,
    value,
    probability,
    expected_revenue: (value * probability) / 100,
    close_date: "2026-12-31",
    is_late: false,
    position: id,
    closed_at: stage === "won" || stage === "lost" ? "2026-11-10T10:00:00" : null,
    created_at: "2026-10-01T09:00:00",
    updated_at: "2026-10-01T09:00:00",
    ...overrides,
  };
}

const board = () => {
  nextId = 1;
  return [
    deal("new", 10_000, { name: "Depot lease" }),
    deal("new", 20_000, { name: "Fleet renewal" }),
    deal("proposal", 50_000, { name: "Warehouse fit-out" }),
    deal("won", 30_000, { name: "Signed deal" }),
  ];
};

// jsdom has no layout. Give each column a place side by side, and each card a row in its column, so the
// keyboard sensor can measure them: columns 300px apart, cards 110px apart. The lifted copy that follows
// the keys starts on the card it was lifted from.
function fakeLayout() {
  const stages: string[] = STAGES.map((s) => s.key);
  function rectOf(el: Element): DOMRect {
    const column = el.closest<HTMLElement>("section[data-stage]");
    const lifted = document.querySelector(".draggable.dragging");
    if (!column && lifted) return rectOf(lifted);
    const left = column ? stages.indexOf(column.dataset.stage ?? "") * 300 : 0;
    let top = 100;
    let height = 800;
    if (el instanceof HTMLElement && el.dataset.boardCard !== undefined && column) {
      top = 160 + Array.from(column.querySelectorAll("[data-board-card]")).indexOf(el) * 110;
      height = 100;
    }
    const box = { x: left, y: top, left, top, width: 280, height, right: left + 280, bottom: top + height };
    return { ...box, toJSON: () => box };
  }
  return vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    return rectOf(this);
  });
}

const column = (label: string) => screen.getByRole("region", { name: `${label} column` });
const card = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name},`) });

/** Presses keys on the focused card, one at a time; dnd-kit listens for the next key after a tick. */
async function press(target: HTMLElement, codes: string[]) {
  for (const code of codes) {
    await act(async () => {
      fireEvent.keyDown(document.activeElement ?? target, { code, key: code === "Space" ? " " : code });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function keyboardMove(name: string, keys: string[]) {
  const target = card(name);
  target.focus();
  await press(target, ["Space", ...keys, "Space"]);
}

describe("the pipeline's figures", () => {
  it("R61 totals the open stages only and shows each in the stage strip", async () => {
    fakeApi({ "GET /api/deals": board() });
    renderPage(<PipelinePage />);
    expect(await screen.findByTestId("open-pipeline")).toHaveTextContent("$80,000");
    expect(screen.getByTestId("open-expected")).toHaveTextContent("$21,500");
    const strip = screen.getByRole("region", { name: "Open pipeline by stage" });
    expect(within(strip).getByText(/New · 2 deals/)).toBeInTheDocument();
    expect(within(strip).getByText(/Proposal · 1 deal$/)).toBeInTheDocument();
    expect(within(strip).getByText(/Negotiation · 0 deals/)).toBeInTheDocument();
  });

  it("R61 shows an empty strip when nothing is open", async () => {
    fakeApi({ "GET /api/deals": [] });
    renderPage(<PipelinePage />);
    expect(await screen.findByTestId("open-pipeline")).toHaveTextContent("$0");
    expect(document.querySelector(".strip-empty")).toBeInTheDocument();
  });

  it("OBS-3 says when the pipeline can't be loaded", async () => {
    fakeApi({ "GET /api/deals": () => json(500, {}) });
    renderPage(<PipelinePage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load the pipeline.");
  });
});

describe("opening and adding deals", () => {
  it("R62 opens a deal's page when its card is clicked", async () => {
    fakeApi({ "GET /api/deals": board() });
    renderPage(<PipelinePage />, { at: "/pipeline", path: "/pipeline" });
    fireEvent.click(await screen.findByText("Fleet renewal"));
    expect(await screen.findByText("Left the page")).toBeInTheDocument();
  });

  it("R66 opens a deal with Enter", async () => {
    fakeApi({ "GET /api/deals": board() });
    renderPage(<PipelinePage />, { at: "/pipeline", path: "/pipeline" });
    await screen.findByText("Fleet renewal");
    fireEvent.keyDown(card("Fleet renewal"), { key: "Enter", code: "Enter" });
    expect(await screen.findByText("Left the page")).toBeInTheDocument();
  });

  it("R65 adds a deal in the column's stage", async () => {
    fakeApi({ "GET /api/deals": board() });
    renderPage(<PipelinePage />);
    await screen.findByText("Warehouse fit-out");
    fireEvent.click(within(column("Proposal")).getByRole("button", { name: "Add deal" }));
    const panel = await screen.findByRole("dialog", { name: "Add deal in Proposal" });
    expect((within(panel).getByLabelText("Stage") as HTMLSelectElement).value).toBe("proposal");
    expect((within(panel).getByLabelText("Probability (%)") as HTMLInputElement).value).toBe("40");
    fireEvent.click(within(panel).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("R65 closes the add panel with its close button", async () => {
    fakeApi({ "GET /api/deals": board() });
    renderPage(<PipelinePage />);
    await screen.findByText("Depot lease");
    fireEvent.click(within(column("New")).getByRole("button", { name: "Add deal" }));
    const panel = await screen.findByRole("dialog", { name: "Add deal in New" });
    fireEvent.click(within(panel).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

describe("moving a card with the keyboard (R66)", () => {
  let layout: ReturnType<typeof fakeLayout>;
  beforeEach(() => {
    layout = fakeLayout();
  });
  afterEach(() => layout.mockRestore());

  it("R63 R64 moves a card to the next column and shows it there at once", async () => {
    const [depot, ...rest] = board();
    if (!depot) throw new Error("The board has no deals.");
    const deals = [depot, ...rest];
    const moved = { ...depot, stage: "qualified" as const, probability: 20, expected_revenue: 2000, position: 1 };
    let current = deals;
    const sent = fakeApi({
      "GET /api/deals": () => json(200, current),
      "POST /api/deals/1/move": () => {
        current = [moved, ...rest];
        return json(200, { deal: moved, renumbered: [] });
      },
    });
    renderPage(<PipelinePage />);
    await screen.findByText("Depot lease");
    await keyboardMove("Depot lease", ["ArrowRight"]);
    await waitFor(() =>
      expect(sent).toContainEqual({
        method: "POST",
        url: "/api/deals/1/move",
        body: { stage: "qualified", before_id: null, after_id: null },
      }),
    );
    await waitFor(() => expect(within(column("Qualified")).getByText("Depot lease")).toBeInTheDocument());
  });

  it("R63 reorders within a column", async () => {
    const sent = fakeApi({
      "GET /api/deals": board(),
      "POST /api/deals/1/move": () => json(500, {}),
    });
    renderPage(<PipelinePage />);
    await screen.findByText("Depot lease");
    await keyboardMove("Depot lease", ["ArrowDown", "ArrowDown"]);
    await waitFor(() =>
      expect(sent).toContainEqual({
        method: "POST",
        url: "/api/deals/1/move",
        body: { stage: "new", before_id: 2, after_id: null },
      }),
    );
    // REL-8: a failed move puts the board back and says so.
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't move the deal.");
    expect(within(column("New")).getByText("Depot lease")).toBeInTheDocument();
  });

  it("R63 leaves a card where it was when it's dropped in its own place", async () => {
    const sent = fakeApi({ "GET /api/deals": board() });
    renderPage(<PipelinePage />);
    await screen.findByText("Depot lease");
    await keyboardMove("Depot lease", ["ArrowUp"]);
    await keyboardMove("Fleet renewal", ["ArrowLeft"]);
    expect(sent.filter((r) => r.method === "POST")).toEqual([]);
  });

  it("R60 puts a card dropped on Won at the top, and REL-11 says when the board changed", async () => {
    const sent = fakeApi({
      "GET /api/deals": board(),
      "POST /api/deals/3/move": () =>
        json(409, { error: { code: "stale_position", message: "The board changed. Try again." } }),
    });
    renderPage(<PipelinePage />);
    await screen.findByText("Warehouse fit-out");
    await keyboardMove("Warehouse fit-out", ["ArrowRight", "ArrowRight"]);
    await waitFor(() =>
      expect(sent).toContainEqual({
        method: "POST",
        url: "/api/deals/3/move",
        body: { stage: "won", before_id: null, after_id: 4 },
      }),
    );
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The board changed. Try again.");
    fireEvent.click(within(alert).getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("R66 cancels a lift with Escape", async () => {
    const sent = fakeApi({ "GET /api/deals": board() });
    renderPage(<PipelinePage />);
    await screen.findByText("Depot lease");
    const target = card("Depot lease");
    target.focus();
    await press(target, ["Space", "ArrowRight"]);
    expect(document.querySelector(".draggable.dragging")).toBeInTheDocument();
    await press(target, ["Escape"]);
    expect(document.querySelector(".draggable.dragging")).not.toBeInTheDocument();
    expect(sent.filter((r) => r.method === "POST")).toEqual([]);
  });
});
