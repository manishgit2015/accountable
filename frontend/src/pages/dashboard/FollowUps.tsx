import { useState } from "react";
import { Link } from "react-router";

import type { Dashboard, FollowUp } from "../../api/types";
import { EmptyState } from "../../components/EmptyState";
import { Panel } from "../../components/Panel";
import { sourcePath } from "../../components/Timeline";
import { formatDateShort } from "../../lib/format";

interface FollowUpsProps {
  followUps: Dashboard["followUps"];
  /** Saves "done". Rejecting puts the item back. */
  onMarkDone: (followUp: FollowUp) => Promise<unknown>;
}

const GROUPS = [
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "next7Days", label: "Next 7 days" },
] as const;

/** R76: open follow-ups in Overdue, Today and Next 7 days, a count of later ones, and a tick to finish one. */
export function FollowUps({ followUps, onMarkDone }: FollowUpsProps) {
  // Ticked items leave the list at once; the dashboard's refetch confirms it (R76).
  const [ticked, setTicked] = useState<Set<number>>(() => new Set());
  const [message, setMessage] = useState<string | null>(null);

  function markDone(item: FollowUp) {
    setMessage(null);
    setTicked((s) => new Set(s).add(item.id));
    onMarkDone(item).catch(() => {
      setTicked((s) => {
        const next = new Set(s);
        next.delete(item.id);
        return next;
      });
      setMessage("Couldn't mark it done. Check the app is still running and try again.");
    });
  }

  const groups = GROUPS.map((g) => ({ ...g, items: followUps[g.key].filter((f) => !ticked.has(f.id)) }));
  const empty = groups.every((g) => g.items.length === 0);
  const later = followUps.laterCount;

  return (
    <Panel
      title="Follow-ups"
      className="c6"
      aside={later > 0 ? <span className="sub">{later} more due later</span> : undefined}
    >
      {message && (
        <p className="error-text" role="alert">
          {message}
        </p>
      )}
      {empty ? (
        <EmptyState message={later > 0 ? "Nothing due in the next 7 days" : "No follow-ups due"} />
      ) : (
        groups.map((group) => (
          <section key={group.key} aria-label={group.label} className="follow-group">
            <div className={group.key === "overdue" ? "group-label late-text" : "group-label"}>
              {group.label} · {group.items.length}
            </div>
            {group.items.length > 0 && (
              <ul className="feed">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <input
                      type="checkbox"
                      className="check"
                      aria-label={`Mark done: ${item.description}`}
                      onChange={() => markDone(item)}
                    />
                    <div className="body">
                      <div className="title">{item.description}</div>
                      <div className="meta">
                        <Link to={sourcePath(item.source)}>{item.source.name}</Link>
                      </div>
                    </div>
                    <span className={group.key === "overdue" ? "num due late-text" : "num due muted"}>
                      {group.key === "today" ? "Today" : formatDateShort(item.followUpDate ?? "")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))
      )}
    </Panel>
  );
}
