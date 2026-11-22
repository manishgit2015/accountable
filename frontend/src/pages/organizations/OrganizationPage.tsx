import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { ApiError } from "../../api/client";
import { useContacts, useDeals, useOrganization, useTimelineItems } from "../../api/queries";
import { ActivityTimeline } from "../../components/ActivityForm";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { DeleteRecordDialog } from "../../components/ConfirmDialog";
import { EmptyState, QueryState } from "../../components/EmptyState";
import { NotFound } from "../../components/NotFound";
import { Panel } from "../../components/Panel";
import { SidePanel } from "../../components/SidePanel";
import { ContactForm } from "../../forms/ContactForm";
import { DealForm } from "../../forms/DealForm";
import { OrganizationForm } from "../../forms/OrganizationForm";
import { isOpenStage, stageLabel, statusLabel } from "../../lib/deals";
import { formatDate, formatMoney } from "../../lib/format";

/** SEC-6: a website is a link only for http and https, in a new tab, without an opener. */
export function WebsiteLink({ url, short = false }: { url: string | null; short?: boolean }) {
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) return <span>{url}</span>;
  const label = short ? url.replace(/^https?:\/\//i, "").replace(/\/$/, "") : url;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  );
}

/** A record id from the address, or null when it isn't one. */
export function useRecordId(): number | null {
  const { id } = useParams();
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function isMissing(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/** R50: details, contacts, deals and the combined timeline. */
export function OrganizationPage() {
  const id = useRecordId();
  if (id === null) return <NotFound noun="organization" listPath="/organizations" listLabel="organizations" />;
  return <OrganizationRecord id={id} />;
}

function OrganizationRecord({ id }: { id: number }) {
  const organization = useOrganization(id);
  const contacts = useContacts();
  const deals = useDeals();
  const timeline = useTimelineItems("organization", id, organization.isSuccess);
  const navigate = useNavigate();
  const [panel, setPanel] = useState<"edit" | "contact" | "deal" | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (isMissing(organization.error)) {
    return <NotFound noun="organization" listPath="/organizations" listLabel="organizations" />;
  }

  return (
    <QueryState query={organization} what="organization">
      {(org) => {
        const theirContacts = (contacts.data ?? []).filter((c) => c.organizationId === org.id);
        const theirDeals = (deals.data ?? []).filter((d) => d.organizationId === org.id);
        return (
          <>
            <div className="record-head">
              <div>
                <Link to="/organizations" className="label">
                  Organizations
                </Link>
                <h1 className="page-title">{org.name}</h1>
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
                    <dt>Website</dt>
                    <dd>{org.website ? <WebsiteLink url={org.website} /> : "None"}</dd>
                    <dt>Industry</dt>
                    <dd>{org.industry ?? "None"}</dd>
                    <dt>Open deals</dt>
                    <dd className="num">
                      {org.openDealCount} · {formatMoney(org.openValue)}
                    </dd>
                    <dt>Notes</dt>
                    <dd className="notes">{org.notes ?? "None"}</dd>
                  </dl>
                </Panel>
                <Panel
                  title={`Contacts · ${theirContacts.length}`}
                  aside={
                    <button type="button" className="link-button" onClick={() => setPanel("contact")}>
                      Add contact
                    </button>
                  }
                >
                  {theirContacts.length === 0 ? (
                    <EmptyState message="No contacts yet" />
                  ) : (
                    <ul className="record-list" aria-label="Contacts">
                      {theirContacts.map((c) => (
                        <li key={c.id}>
                          <div>
                            <Link to={`/contacts/${c.id}`}>{c.name}</Link>
                            <div className="meta">{c.jobTitle ?? ""}</div>
                          </div>
                          <Badge kind={c.status}>{statusLabel(c.status)}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
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
              <Panel title="Timeline" className="record-main">
                <QueryState query={timeline} what="timeline">
                  {(items) => <ActivityTimeline items={items} showSource emptyMessage="Nothing logged yet" />}
                </QueryState>
              </Panel>
            </div>
            <SidePanel
              open={panel !== null}
              onOpenChange={(open) => !open && setPanel(null)}
              title={panel === "edit" ? "Edit organization" : panel === "contact" ? "Add contact" : "Add deal"}
            >
              {panel === "edit" && (
                <OrganizationForm organization={org} onSaved={() => setPanel(null)} onCancel={() => setPanel(null)} />
              )}
              {panel === "contact" && (
                <ContactForm
                  defaultOrganizationId={org.id}
                  onSaved={() => setPanel(null)}
                  onCancel={() => setPanel(null)}
                />
              )}
              {panel === "deal" && (
                <DealForm
                  defaultOrganizationId={org.id}
                  onSaved={() => setPanel(null)}
                  onCancel={() => setPanel(null)}
                />
              )}
            </SidePanel>
            <DeleteRecordDialog
              kind="organization"
              record={deleting ? org : null}
              onClose={() => setDeleting(false)}
              onDeleted={() => navigate("/organizations")}
            />
          </>
        );
      }}
    </QueryState>
  );
}
