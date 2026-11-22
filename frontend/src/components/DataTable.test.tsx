// V-F03: search, sort, 25 per page, the count, default sort, and the empty and no-match messages.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DataTable, columnHelper } from "./DataTable";

interface Row {
  id: number;
  name: string;
  city: string | null;
  value: number;
}

const helper = columnHelper<Row>();
const columns = helper.columns([
  helper.accessor("name", { header: "Name" }),
  helper.accessor("city", { header: "City", cell: (c) => c.getValue() ?? "" }),
  helper.accessor("value", { header: "Value", enableGlobalFilter: false }),
]);

function rows(n: number): Row[] {
  // Names out of order, so the default sort has work to do.
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    name: `Org ${String(n - i).padStart(3, "0")}`,
    city: i % 2 ? "Leeds" : "york",
    value: i * 10,
  }));
}

function renderTable(data: Row[], onAdd = vi.fn(), onRowClick = vi.fn()) {
  render(
    <DataTable
      data={data}
      columns={columns}
      noun="organizations"
      defaultSort={[{ id: "name", desc: false }]}
      addLabel="Add organization"
      onAdd={onAdd}
      onRowClick={onRowClick}
      numericColumns={["value"]}
      getRowId={(r) => String(r.id)}
    />,
  );
  return { onAdd, onRowClick };
}

function bodyNames(): string[] {
  const body = screen.getAllByRole("rowgroup")[1];
  if (!body) throw new Error("no table body");
  return within(body)
    .getAllByRole("row")
    .map((r) => within(r).getAllByRole("cell")[0]?.textContent ?? "");
}

describe("DataTable", () => {
  it("R43 R47 shows 25 rows per page, sorted by the default column, with the count", () => {
    renderTable(rows(60));
    expect(bodyNames()).toHaveLength(25);
    expect(bodyNames()[0]).toBe("Org 001");
    expect(screen.getByText("Showing 1–25 of 60")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Showing 26–50 of 60")).toBeInTheDocument();
    expect(bodyNames()[0]).toBe("Org 026");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Showing 51–60 of 60")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByText("Showing 26–50 of 60")).toBeInTheDocument();
  });

  it("R41 sorts by a clicked heading, reverses on a second click, and marks the sort", () => {
    renderTable(rows(5));
    const nameHeader = screen.getByRole("columnheader", { name: /Name/ });
    expect(nameHeader).toHaveAttribute("aria-sort", "ascending");
    fireEvent.click(within(nameHeader).getByRole("button"));
    expect(nameHeader).toHaveAttribute("aria-sort", "descending");
    expect(bodyNames()[0]).toBe("Org 005");

    const valueHeader = screen.getByRole("columnheader", { name: /Value/ });
    fireEvent.click(within(valueHeader).getByRole("button"));
    expect(valueHeader).toHaveAttribute("aria-sort", "ascending");
    expect(nameHeader).not.toHaveAttribute("aria-sort");
    expect(bodyNames()).toEqual(["Org 005", "Org 004", "Org 003", "Org 002", "Org 001"]);
  });

  it("R41 sorts text ignoring case", () => {
    renderTable(rows(4));
    fireEvent.click(within(screen.getByRole("columnheader", { name: /City/ })).getByRole("button"));
    const cities = screen
      .getAllByRole("row")
      .slice(1)
      .map((r) => within(r).getAllByRole("cell")[1]?.textContent);
    expect(cities).toEqual(["Leeds", "Leeds", "york", "york"]);
  });

  it("R40 searches any text column as you type, ignoring case, and resets to the first page", () => {
    renderTable(rows(60));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search organizations" }), { target: { value: "LEEDS" } });
    expect(screen.getByText("Showing 1–25 of 30")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "org 007" } });
    expect(bodyNames()).toEqual(["Org 007"]);
  });

  it("R40 doesn't search number columns", () => {
    renderTable(rows(5));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "40" } });
    expect(screen.getByText("No matches for ‘40’")).toBeInTheDocument();
  });

  it("spec 4.5 a search with no matches says so, with a clear-search link", () => {
    renderTable(rows(5));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "xyz" } });
    expect(screen.getByText("No matches for ‘xyz’")).toBeInTheDocument();
    expect(screen.getByText("Showing 0 of 0")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(bodyNames()).toHaveLength(5);
  });

  it("R46 an empty table shows a short message and its Add button", () => {
    const { onAdd } = renderTable([]);
    expect(screen.getByText("No organizations yet")).toBeInTheDocument();
    const adds = screen.getAllByRole("button", { name: "Add organization" });
    fireEvent.click(adds[adds.length - 1] as HTMLElement);
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it("R42 clicking a row opens the record", () => {
    const { onRowClick } = renderTable(rows(3));
    fireEvent.click(screen.getByText("Org 002"));
    expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ name: "Org 002" }));
  });

  it("spec 3.9 right-aligns number columns in the mono font", () => {
    renderTable(rows(2));
    const cell = screen.getAllByRole("row")[1]?.querySelectorAll("td")[2];
    expect(cell).toHaveClass("numeric", "num");
  });
});
