import { Link } from "react-router";

import type { TimelineEntry } from "../../api/types";
import { EmptyState } from "../../components/EmptyState";
import { Panel } from "../../components/Panel";
import { EntryIcon, sourcePath } from "../../components/Timeline";
import { stageLabel } from "../../lib/deals";
import { formatDateTime } from "../../lib/format";

function title(entry: TimelineEntry): string {
  if (entry.kind === "activity") return entry.description ?? "";
  const to = entry.toStage ? stageLabel(entry.toStage) : "";
  return entry.fromStage
    ? `${entry.source.name} moved from ${stageLabel(entry.fromStage)} to ${to}`
    : `${entry.source.name} created at ${to}`;
}

/** R75: the 10 latest activities and stage changes, each linking to its record. */
export function RecentActivity({ recent }: { recent: TimelineEntry[] }) {
  return (
    <Panel title="Recent activity" className="c6" aside={<span className="sub">Latest 10</span>}>
      {recent.length === 0 ? (
        <EmptyState message="No activity yet" />
      ) : (
        <ul className="feed" aria-label="Recent activity">
          {recent.map((entry) => (
            <li key={`${entry.kind}-${entry.id}`}>
              <EntryIcon type={entry.type} toStage={entry.toStage} />
              <div className="body">
                <Link to={sourcePath(entry.source)} className="title">
                  {title(entry)}
                </Link>
                <div className="meta">
                  {entry.source.name} · {formatDateTime(entry.at)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
