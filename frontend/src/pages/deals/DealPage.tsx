import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { useDeal, useOffline, useTimelineItems, useUpdateDeal } from "../../api/queries";
import type { Stage } from "../../api/types";
import { ActivityForm, ActivityTimeline } from "../../components/ActivityForm";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { DeleteRecordDialog } from "../../components/ConfirmDialog";
import { QueryState } from "../../components/EmptyState";
import { NotFound } from "../../components/NotFound";
import { Panel } from "../../components/Panel";
import { SidePanel } from "../../components/SidePanel";
import { DealForm } from "../../forms/DealForm";
import { FormError } from "../../forms/fields";
import { STAGES, stageLabel } from "../../lib/deals";
import { formatDate, formatDateTime, formatMoney } from "../../lib/format";
import { isMissing, useRecordId } from "../organizations/OrganizationPage";

/** R52, R53: details, the stage picker, links, a late warning, "Log activity" and the timeline. */
export function DealPage() {
  const id = useRecordId();
  if (id === null) return <NotFound noun="deal" listPath="/deals" listLabel="deals" />;
  return <DealRecord id={id} />;
}

function DealRecord({ id }: { id: number }) {
  const deal = useDeal(id);
  const timeline = useTimelineItems("deal", id, deal.isSuccess);
  const update = useUpdateDeal();
  const offline = useOffline();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [stageError, setStageError] = useState<string | null>(null);

  if (isMissing(deal.error)) return <NotFound noun="deal" listPath="/deals" listLabel="deals" />;

  return (
    <QueryState query={deal} what="deal">
      {(d) => (
        <>
          <div className="record-head">
            <div>
              <Link to="/deals" className="label">
                Deals
              </Link>
              <h1 className="page-title">
                {d.name} <Badge kind={d.stage}>{stageLabel(d.stage)}</Badge>
              </h1>
            </div>
            <div className="record-actions">
              <Button onClick={() => setEditing(true)}>Edit</Button>
              <Button onClick={() => setDeleting(true)}>Delete</Button>
            </div>
          </div>
          {d.isLate && (
            <div className="late-warning" role="status">
              <AlertTriangle size={18} aria-hidden="true" />
              This deal is running late: its close date was {formatDate(d.closeDate)}.
            </div>
          )}
          <div className="record-grid">
            <div className="record-side">
              <Panel title="Details">
                <div className="field">
                  <label htmlFor="deal-stage">Stage</label>
                  <select
                    id="deal-stage"
                    value={d.stage}
                    disabled={update.isPending || offline}
                    onChange={(event) => {
                      setStageError(null);
                      // R15–R18 run on the server; the page shows its answer.
                      update.mutate(
                        { id: d.id, input: { stage: event.target.value as Stage } },
                        {
                          onError: () =>
                            setStageError("Couldn't change the stage. Check the app is still running and try again."),
                        },
                      );
                    }}
                  >
                    {STAGES.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <FormError message={stageError} />
                <dl className="details">
                  <dt>Organization</dt>
                  <dd>
                    {d.organizationId === null ? (
                      "None"
                    ) : (
                      <Link to={`/organizations/${d.organizationId}`}>{d.organizationName}</Link>
                    )}
                  </dd>
                  <dt>Main contact</dt>
                  <dd>
                    {d.contactId === null ? "None" : <Link to={`/contacts/${d.contactId}`}>{d.contactName}</Link>}
                  </dd>
                  <dt>Value</dt>
                  <dd className="num">{formatMoney(d.value)}</dd>
                  <dt>Probability</dt>
                  <dd className="num">{d.probability}%</dd>
                  <dt>Expected revenue</dt>
                  <dd className="num">{formatMoney(d.expectedRevenue)}</dd>
                  <dt>Close date</dt>
                  <dd className={d.isLate ? "num late-text" : "num"}>{formatDate(d.closeDate)}</dd>
                  {d.closedAt && (
                    <>
                      <dt>Closed</dt>
                      <dd className="num">{formatDateTime(d.closedAt)}</dd>
                    </>
                  )}
                </dl>
              </Panel>
            </div>
            <div className="record-main">
              <Panel title="Log activity">
                <ActivityForm target={{ dealId: d.id }} />
              </Panel>
              <Panel title="Timeline">
                <QueryState query={timeline} what="timeline">
                  {(items) => <ActivityTimeline items={items} />}
                </QueryState>
              </Panel>
            </div>
          </div>
          <SidePanel open={editing} onOpenChange={setEditing} title="Edit deal">
            {editing && <DealForm deal={d} onSaved={() => setEditing(false)} onCancel={() => setEditing(false)} />}
          </SidePanel>
          <DeleteRecordDialog
            kind="deal"
            record={deleting ? d : null}
            onClose={() => setDeleting(false)}
            onDeleted={() => navigate("/deals")}
          />
        </>
      )}
    </QueryState>
  );
}
