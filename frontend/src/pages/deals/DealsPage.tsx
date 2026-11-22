import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import { useDeals } from "../../api/queries";
import type { Deal } from "../../api/types";
import { Badge } from "../../components/Badge";
import { DeleteRecordDialog } from "../../components/ConfirmDialog";
import { DataTable, columnHelper, type RowAction } from "../../components/DataTable";
import { QueryState } from "../../components/EmptyState";
import { SidePanel } from "../../components/SidePanel";
import { DealForm } from "../../forms/DealForm";
import { STAGES, stageLabel } from "../../lib/deals";
import { formatDate, formatMoney } from "../../lib/format";

const helper = columnHelper<Deal>();
const stageOrder = (deal: Deal) => STAGES.findIndex((s) => s.key === deal.stage);

/** R19, R44: a late deal shows a Raspberry "Late" badge and its close date in Raspberry text. */
export function CloseDate({ deal }: { deal: Deal }) {
  if (!deal.isLate) return <span className="num">{formatDate(deal.closeDate)}</span>;
  return (
    <span className="late-date">
      <Badge kind="late">Late</Badge>
      <span className="num late-text">{formatDate(deal.closeDate)}</span>
    </span>
  );
}

// R44: Name, Organization, Main contact, Stage, Value, Probability, Expected revenue, Close date.
const columns = helper.columns([
  helper.accessor("name", { header: "Name", cell: (c) => <span className="cell-strong">{c.getValue()}</span> }),
  helper.accessor("organizationName", {
    header: "Organization",
    cell: (c) => {
      const id = c.row.original.organizationId;
      return id === null ? (
        <span className="muted">None</span>
      ) : (
        <Link to={`/organizations/${id}`}>{c.getValue()}</Link>
      );
    },
  }),
  helper.accessor("contactName", {
    header: "Main contact",
    cell: (c) => {
      const id = c.row.original.contactId;
      return id === null ? <span className="muted">None</span> : <Link to={`/contacts/${id}`}>{c.getValue()}</Link>;
    },
  }),
  helper.accessor((row) => stageLabel(row.stage), {
    id: "stage",
    header: "Stage",
    sortFn: (a, b) => stageOrder(a.original) - stageOrder(b.original),
    cell: (c) => <Badge kind={c.row.original.stage}>{c.getValue()}</Badge>,
  }),
  helper.accessor("value", {
    header: "Value (USD)",
    enableGlobalFilter: false,
    cell: (c) => formatMoney(c.getValue()),
  }),
  helper.accessor("probability", { header: "Probability", enableGlobalFilter: false, cell: (c) => `${c.getValue()}%` }),
  helper.accessor("expectedRevenue", {
    header: "Expected revenue (USD)",
    enableGlobalFilter: false,
    cell: (c) => formatMoney(c.getValue()),
  }),
  helper.accessor((row) => formatDate(row.closeDate), {
    id: "closeDate",
    header: "Close date",
    sortFn: (a, b) => a.original.closeDate.localeCompare(b.original.closeDate),
    cell: (c) => <CloseDate deal={c.row.original} />,
  }),
]);

/** R40–R47 for deals. Default sort: close date, soonest first (R47). */
export function DealsPage() {
  const deals = useDeals();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<Deal | "new" | null>(null);
  const [deleting, setDeleting] = useState<Deal | null>(null);

  const actions = useMemo<RowAction<Deal>[]>(
    () => [
      { label: "Edit", onSelect: (row) => setEditing(row) },
      { label: "Delete", onSelect: (row) => setDeleting(row), destructive: true },
    ],
    [],
  );

  return (
    <>
      <h1 className="page-title">Deals</h1>
      <QueryState query={deals} what="deals">
        {(data) => (
          <DataTable
            data={data}
            columns={columns}
            noun="deals"
            defaultSort={[{ id: "closeDate", desc: false }]}
            addLabel="Add deal"
            onAdd={() => setEditing("new")}
            onRowClick={(row) => navigate(`/deals/${row.id}`)}
            rowActions={actions}
            numericColumns={["value", "probability", "expectedRevenue"]}
            getRowId={(row) => String(row.id)}
          />
        )}
      </QueryState>
      <SidePanel
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing === "new" ? "Add deal" : "Edit deal"}
      >
        {editing !== null && (
          <DealForm
            deal={editing === "new" ? undefined : editing}
            onSaved={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        )}
      </SidePanel>
      <DeleteRecordDialog kind="deal" record={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}
