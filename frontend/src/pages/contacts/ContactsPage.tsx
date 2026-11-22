import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import { useContacts } from "../../api/queries";
import type { Contact, ContactStatus } from "../../api/types";
import { Badge } from "../../components/Badge";
import { DeleteRecordDialog } from "../../components/ConfirmDialog";
import { DataTable, columnHelper, type RowAction } from "../../components/DataTable";
import { QueryState } from "../../components/EmptyState";
import { SidePanel } from "../../components/SidePanel";
import { ContactForm } from "../../forms/ContactForm";
import { CONTACT_STATUSES, statusLabel } from "../../lib/deals";

const helper = columnHelper<Contact>();

// R44: Name, Organization, Job title, Email, Phone, Status.
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
  helper.accessor("jobTitle", { header: "Job title", cell: (c) => c.getValue() ?? "" }),
  helper.accessor("email", { header: "Email", cell: (c) => c.getValue() ?? "" }),
  helper.accessor("phone", { header: "Phone", cell: (c) => c.getValue() ?? "" }),
  helper.accessor((row) => statusLabel(row.status), {
    id: "status",
    header: "Status",
    cell: (c) => <Badge kind={c.row.original.status}>{c.getValue()}</Badge>,
  }),
]);

type Filter = ContactStatus | "all";

/** R40–R47 for contacts, with the status filter (R44). */
export function ContactsPage() {
  const contacts = useContacts();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Contact | "new" | null>(null);
  const [deleting, setDeleting] = useState<Contact | null>(null);

  const actions = useMemo<RowAction<Contact>[]>(
    () => [
      { label: "Edit", onSelect: (row) => setEditing(row) },
      { label: "Delete", onSelect: (row) => setDeleting(row), destructive: true },
    ],
    [],
  );

  return (
    <>
      <h1 className="page-title">Contacts</h1>
      <QueryState query={contacts} what="contacts">
        {(data) => {
          const counts = { all: data.length, lead: 0, qualified: 0, customer: 0 };
          for (const c of data) counts[c.status] += 1;
          const shown = filter === "all" ? data : data.filter((c) => c.status === filter);
          const segments: { key: Filter; label: string }[] = [{ key: "all", label: "All" }, ...CONTACT_STATUSES];
          return (
            <DataTable
              data={shown}
              columns={columns}
              noun="contacts"
              defaultSort={[{ id: "name", desc: false }]}
              addLabel="Add contact"
              onAdd={() => setEditing("new")}
              onRowClick={(row) => navigate(`/contacts/${row.id}`)}
              rowActions={actions}
              getRowId={(row) => String(row.id)}
              emptyMessage={
                filter === "all" ? "No contacts yet" : `No ${statusLabel(filter).toLowerCase()} contacts yet`
              }
              toolbar={
                <div className="segmented" role="group" aria-label="Status">
                  {segments.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      aria-pressed={filter === s.key}
                      className={filter === s.key ? "on" : undefined}
                      onClick={() => setFilter(s.key)}
                    >
                      {s.label} <span className="num">{counts[s.key]}</span>
                    </button>
                  ))}
                </div>
              }
            />
          );
        }}
      </QueryState>
      <SidePanel
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing === "new" ? "Add contact" : "Edit contact"}
      >
        {editing !== null && (
          <ContactForm
            contact={editing === "new" ? undefined : editing}
            onSaved={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        )}
      </SidePanel>
      <DeleteRecordDialog kind="contact" record={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}
