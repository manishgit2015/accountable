import { useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { useOrganizations } from "../../api/queries";
import type { Organization } from "../../api/types";
import { DeleteRecordDialog } from "../../components/ConfirmDialog";
import { DataTable, columnHelper, type RowAction } from "../../components/DataTable";
import { QueryState } from "../../components/EmptyState";
import { SidePanel } from "../../components/SidePanel";
import { OrganizationForm } from "../../forms/OrganizationForm";
import { formatMoney } from "../../lib/format";
import { WebsiteLink } from "./OrganizationPage";

const helper = columnHelper<Organization>();

// R44: Name, Industry, Website, Contacts, Open deals, Open value.
const columns = helper.columns([
  helper.accessor("name", { header: "Name", cell: (c) => <span className="cell-strong">{c.getValue()}</span> }),
  helper.accessor("industry", { header: "Industry", cell: (c) => c.getValue() ?? "" }),
  helper.accessor("website", { header: "Website", cell: (c) => <WebsiteLink url={c.getValue()} short /> }),
  helper.accessor("contactCount", { header: "Contacts", enableGlobalFilter: false }),
  helper.accessor("openDealCount", { header: "Open deals", enableGlobalFilter: false }),
  helper.accessor("openValue", {
    header: "Open value (USD)",
    enableGlobalFilter: false,
    cell: (c) => formatMoney(c.getValue()),
  }),
]);

/** R40–R47 for organizations. */
export function OrganizationsPage() {
  const organizations = useOrganizations();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<Organization | "new" | null>(null);
  const [deleting, setDeleting] = useState<Organization | null>(null);

  const actions = useMemo<RowAction<Organization>[]>(
    () => [
      { label: "Edit", onSelect: (row) => setEditing(row) },
      { label: "Delete", onSelect: (row) => setDeleting(row), destructive: true },
    ],
    [],
  );

  return (
    <>
      <h1 className="page-title">Organizations</h1>
      <QueryState query={organizations} what="organizations">
        {(data) => (
          <DataTable
            data={data}
            columns={columns}
            noun="organizations"
            defaultSort={[{ id: "name", desc: false }]}
            addLabel="Add organization"
            onAdd={() => setEditing("new")}
            onRowClick={(row) => navigate(`/organizations/${row.id}`)}
            rowActions={actions}
            numericColumns={["contactCount", "openDealCount", "openValue"]}
            getRowId={(row) => String(row.id)}
          />
        )}
      </QueryState>
      <SidePanel
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing === "new" ? "Add organization" : "Edit organization"}
      >
        {editing !== null && (
          <OrganizationForm
            organization={editing === "new" ? undefined : editing}
            onSaved={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        )}
      </SidePanel>
      <DeleteRecordDialog kind="organization" record={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}
