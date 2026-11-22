import * as Menu from "@radix-ui/react-dropdown-menu";
import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type PaginationState,
  type Row,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, MoreHorizontal, Plus, Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { Button } from "./Button";
import { EmptyState } from "./EmptyState";

/** The table features every list uses: search, sort and 25 rows per page (R40, R41, R43). */
export const tableFeatureSet = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
});

type Features = typeof tableFeatureSet;
export type TableColumn<T extends RowData> = ColumnDef<Features, T, unknown>;

/** A column helper bound to the table's features, for the pages' column definitions. */
export function columnHelper<T extends RowData>() {
  return createColumnHelper<Features, T>();
}

export const PAGE_SIZE = 25;

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

/** Case-insensitive text, numbers by value, and empty values last in both directions. */
function compare(rowA: Row<Features, RowData>, rowB: Row<Features, RowData>, columnId: string): number {
  const a = rowA.getValue(columnId);
  const b = rowB.getValue(columnId);
  if (typeof a === "number" && typeof b === "number") return a - b;
  return text(a).localeCompare(text(b), "en", { sensitivity: "base", numeric: true });
}

/** R40: matches any text column, ignoring case. */
function matches(row: Row<Features, RowData>, columnId: string, filterValue: unknown): boolean {
  const needle = text(filterValue).trim().toLowerCase();
  if (!needle) return true;
  return text(row.getValue(columnId)).toLowerCase().includes(needle);
}

export interface RowAction<T extends RowData> {
  label: string;
  onSelect: (row: T) => void;
  destructive?: boolean;
}

interface DataTableProps<T extends RowData> {
  data: T[];
  columns: TableColumn<T>[];
  /** "contacts": used in "No contacts yet" and the search box. */
  noun: string;
  /** Default sort (R47). */
  defaultSort: SortingState;
  addLabel: string;
  onAdd: () => void;
  onRowClick?: (row: T) => void;
  rowActions?: RowAction<T>[];
  /** Columns that hold numbers are right-aligned in JetBrains Mono (spec 3.9). */
  numericColumns?: string[];
  /** Extra controls beside the search box, such as the contacts' status filter. */
  toolbar?: ReactNode;
  getRowId: (row: T) => string;
  /** The rows to show before search (the full list, or a filtered part of it). */
  emptyMessage?: string;
}

/**
 * The shared table for organizations, contacts and deals (R40–R43, R46, R47). It sorts, searches and
 * pages in the browser over the full list (ADR-007). Search and sort reset when the page is left,
 * because they live in this component's state.
 */
export function DataTable<T extends RowData>({
  data,
  columns,
  noun,
  defaultSort,
  addLabel,
  onAdd,
  onRowClick,
  rowActions,
  numericColumns = [],
  toolbar,
  getRowId,
  emptyMessage,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>(defaultSort);
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: PAGE_SIZE });

  const allColumns = useMemo<TableColumn<T>[]>(() => {
    if (!rowActions?.length) return columns;
    return [
      ...columns,
      {
        id: "actions",
        header: () => <span className="visually-hidden">Actions</span>,
        enableSorting: false,
        enableGlobalFilter: false,
        cell: ({ row }) => <RowMenu row={row.original} actions={rowActions} />,
      },
    ];
  }, [columns, rowActions]);

  const table = useTable({
    features: tableFeatureSet,
    columns: allColumns,
    data,
    getRowId: (row) => getRowId(row),
    state: { sorting, globalFilter, pagination },
    onSortingChange: setSorting,
    onGlobalFilterChange: (updater) => {
      setGlobalFilter(updater);
      setPagination((p) => ({ ...p, pageIndex: 0 }));
    },
    onPaginationChange: setPagination,
    globalFilterFn: matches as never,
    getColumnCanGlobalFilter: (column) =>
      (column.columnDef as { enableGlobalFilter?: boolean }).enableGlobalFilter !== false,
    // The casts bridge the generic comparators to the table's row type (typed boundary, ENG-2). Every
    // column sorts ascending first, numbers included, so a first click always means "smallest first".
    defaultColumn: { sortFn: compare as never, sortUndefined: "last", sortDescFirst: false },
    enableSortingRemoval: false,
    enableMultiSort: false,
    autoResetPageIndex: false,
  });

  const filteredCount = table.getFilteredRowModel().rows.length;
  const pageCount = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const pageIndex = Math.min(pagination.pageIndex, pageCount - 1);
  const first = filteredCount === 0 ? 0 : pageIndex * PAGE_SIZE + 1;
  const last = Math.min(filteredCount, (pageIndex + 1) * PAGE_SIZE);
  const rows = table.getRowModel().rows;

  const search = (
    <div className="table-toolbar">
      <label className="search">
        <Search size={16} aria-hidden="true" />
        <span className="visually-hidden">Search {noun}</span>
        <input
          type="search"
          placeholder={`Search ${noun}`}
          value={globalFilter}
          onChange={(event) => table.setGlobalFilter(event.target.value)}
        />
      </label>
      {toolbar}
      <Button variant="primary" className="toolbar-add" onClick={onAdd}>
        <Plus size={16} aria-hidden="true" />
        {addLabel}
      </Button>
    </div>
  );

  if (data.length === 0 && !globalFilter) {
    return (
      <>
        {search}
        <div className="panel">
          <EmptyState message={emptyMessage ?? `No ${noun} yet`}>
            <Button variant="primary" onClick={onAdd}>
              <Plus size={16} aria-hidden="true" />
              {addLabel}
            </Button>
          </EmptyState>
        </div>
      </>
    );
  }

  return (
    <>
      {search}
      <div className="panel table-panel">
        <table className="data-table">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const numeric = numericColumns.includes(header.column.id);
                  const canSort = header.column.getCanSort();
                  return (
                    <th
                      key={header.id}
                      className={numeric ? "numeric" : undefined}
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                    >
                      {canSort ? (
                        <button type="button" className="sort-button" onClick={header.column.getToggleSortingHandler()}>
                          <table.FlexRender header={header} />
                          {sorted === "asc" && <ArrowUp size={13} aria-hidden="true" />}
                          {sorted === "desc" && <ArrowDown size={13} aria-hidden="true" />}
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={onRowClick ? "clickable" : undefined}
                onClick={(event) => {
                  // Links, buttons and menus inside a row do their own thing.
                  if ((event.target as HTMLElement).closest("a, button, [role='menuitem']")) return;
                  onRowClick?.(row.original);
                }}
              >
                {row.getAllCells().map((cell) => (
                  <td key={cell.id} className={numericColumns.includes(cell.column.id) ? "numeric num" : undefined}>
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {filteredCount === 0 && (
          <div className="no-matches">
            <p className="empty-line">No matches for &lsquo;{globalFilter}&rsquo;</p>
            <button type="button" className="link-button" onClick={() => table.setGlobalFilter("")}>
              Clear search
            </button>
          </div>
        )}
        <div className="table-footer">
          <span className="label" aria-live="polite">
            {filteredCount === 0 ? "Showing 0 of 0" : `Showing ${first}–${last} of ${filteredCount}`}
          </span>
          <div className="pager">
            <Button disabled={pageIndex === 0} onClick={() => table.previousPage()}>
              Previous
            </Button>
            <span className="label">
              Page {pageIndex + 1} of {pageCount}
            </span>
            <Button disabled={pageIndex >= pageCount - 1} onClick={() => table.nextPage()}>
              Next
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

/** Edit and Delete for one row (R42), on Radix's dropdown menu. */
export function RowMenu<T extends RowData>({ row, actions }: { row: T; actions: RowAction<T>[] }) {
  return (
    <Menu.Root>
      <Menu.Trigger className="icon-button" aria-label="Row actions">
        <MoreHorizontal size={18} aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content className="menu" align="end" sideOffset={4}>
          {actions.map((action) => (
            <Menu.Item
              key={action.label}
              className={action.destructive ? "menu-item destructive" : "menu-item"}
              onSelect={() => action.onSelect(row)}
            >
              {action.label}
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
