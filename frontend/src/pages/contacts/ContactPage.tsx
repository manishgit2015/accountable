import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { useContact, useDeals, useTimelineItems } from "../../api/queries";
import { ActivityForm, ActivityTimeline } from "../../components/ActivityForm";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { DeleteRecordDialog } from "../../components/ConfirmDialog";
import { EmptyState, QueryState } from "../../components/EmptyState";
import { NotFound } from "../../components/NotFound";
import { Panel } from "../../components/Panel";
import { SidePanel } from "../../components/SidePanel";
import { ContactForm } from "../../forms/ContactForm";
import { DealForm } from "../../forms/DealForm";
import { isOpenStage, stageLabel, statusLabel } from "../../lib/deals";
import { formatDate, formatMoney } from "../../lib/format";
import { isMissing, useRecordId } from "../organizations/OrganizationPage";

/** R51, R53: details, organization, their deals, "Log activity" and the timeline. */
export function ContactPage() {
  const id = useRecordId();
  if (id === null) return <NotFound noun="contact" listPath="/contacts" listLabel="contacts" />;
  return <ContactRecord id={id} />;
}

function ContactRecord({ id }: { id: number }) {
  const contact = useContact(id);
  const deals = useDeals();
  const timeline = useTimelineItems("contact", id, contact.isSuccess);
  const navigate = useNavigate();
  const [panel, setPanel] = useState<"edit" | "deal" | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (isMissing(contact.error)) return <NotFound noun="contact" listPath="/contacts" listLabel="contacts" />;

  return (
    <QueryState query={contact} what="contact">
      {(person) => {
        const theirDeals = (deals.data ?? []).filter((d) => d.contactId === person.id);
        return (
          <>
            <div className="record-head">
              <div>
                <Link to="/contacts" className="label">
                  Contacts
                </Link>
                <h1 className="page-title">
                  {person.name} <Badge kind={person.status}>{statusLabel(person.status)}</Badge>
                </h1>
              </div>
              <div className="record-actions">
                <Button onClick={() => setPanel("edit")}>Edit</Button>
                <Button onClick={() => setDeleting(true)}>Delete</Button>
              </div>
            </div>
            <div className="record-grid">
              <div className="record-side">
                <Panel title="Details">
                  <dl className="details">
                    <dt>Organization</dt>
                    <dd>
                      {person.organizationId === null ? (
                        "None"
                      ) : (
                        <Link to={`/organizations/${person.organizationId}`}>{person.organizationName}</Link>
                      )}
                    </dd>
                    <dt>Job title</dt>
                    <dd>{person.jobTitle ?? "None"}</dd>
                    <dt>Email</dt>
                    <dd>{person.email ?? "None"}</dd>
                    <dt>Phone</dt>
                    <dd>{person.phone ?? "None"}</dd>
                  </dl>
                </Panel>
                <Panel
                  title={`Deals · ${theirDeals.length}`}
                  aside={
                    <button type="button" className="link-button" onClick={() => setPanel("deal")}>
                      Add deal
                    </button>
                  }
                >
                  {theirDeals.length === 0 ? (
                    <EmptyState message="No deals yet" />
                  ) : (
                    <ul className="record-list" aria-label="Deals">
                      {theirDeals.map((d) => (
                        <li key={d.id}>
                          <div>
                            <Link to={`/deals/${d.id}`}>{d.name}</Link>
                            <div className={d.isLate ? "meta late-text" : "meta"}>
                              <span className="num">{formatMoney(d.value)}</span> ·{" "}
                              {isOpenStage(d.stage) ? "closes" : "closed"} {formatDate(d.closeDate)}
                            </div>
                          </div>
                          <Badge kind={d.stage}>{stageLabel(d.stage)}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              </div>
              <div className="record-main">
                <Panel title="Log activity">
                  <ActivityForm target={{ contactId: person.id }} />
                </Panel>
                <Panel title="Timeline">
                  <QueryState query={timeline} what="timeline">
                    {(items) => <ActivityTimeline items={items} showSource />}
                  </QueryState>
                </Panel>
              </div>
            </div>
            <SidePanel
              open={panel !== null}
              onOpenChange={(open) => !open && setPanel(null)}
              title={panel === "edit" ? "Edit contact" : "Add deal"}
            >
              {panel === "edit" && (
                <ContactForm contact={person} onSaved={() => setPanel(null)} onCancel={() => setPanel(null)} />
              )}
              {panel === "deal" && (
                <DealForm
                  defaultOrganizationId={person.organizationId}
                  defaultContactId={person.id}
                  onSaved={() => setPanel(null)}
                  onCancel={() => setPanel(null)}
                />
              )}
            </SidePanel>
            <DeleteRecordDialog
              kind="contact"
              record={deleting ? person : null}
              onClose={() => setDeleting(false)}
              onDeleted={() => navigate("/contacts")}
            />
          </>
        );
      }}
    </QueryState>
  );
}
