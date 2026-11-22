import { ArrowRight, Mail, Phone, StickyNote } from "lucide-react";
import { Link } from "react-router";

import type { Activity, ActivityType, Stage, TimelineEntry } from "../api/types";
import { stageLabel } from "../lib/deals";
import { formatDateShort, formatDateTime } from "../lib/format";
import { EmptyState } from "./EmptyState";

/** A timeline entry, with the full activity when it is one (for its follow-up and done flag). */
export interface TimelineItem extends TimelineEntry {
  activity?: Activity;
}

interface TimelineProps {
  items: TimelineItem[];
  /** R54: on organization and contact pages, say which deal or contact each entry came from. */
  showSource?: boolean;
  onEdit?: (activity: Activity) => void;
  onDelete?: (activity: Activity) => void;
  onToggleDone?: (activity: Activity, done: boolean) => void;
  emptyMessage?: string;
}

const ICONS: Record<ActivityType, typeof Phone> = { note: StickyNote, call: Phone, email: Mail };

export function entryTitle(entry: TimelineEntry): string {
  if (entry.kind === "activity") return entry.description ?? "";
  const to = entry.toStage ? stageLabel(entry.toStage) : "";
  return entry.fromStage ? `Moved from ${stageLabel(entry.fromStage)} to ${to}` : `Created at ${to}`;
}

export function sourcePath(source: TimelineEntry["source"]): string {
  return source.kind === "deal" ? `/deals/${source.id}` : `/contacts/${source.id}`;
}

export function EntryIcon({ type, toStage }: { type: ActivityType | null; toStage: Stage | null }) {
  if (type) {
    const Icon = ICONS[type];
    return (
      <span className="ico" aria-label={type}>
        <Icon size={15} aria-hidden="true" />
      </span>
    );
  }
  return (
    <span className={`ico ico-stage ico-stage-${toStage ?? "new"}`} aria-label="Stage change">
      <ArrowRight size={15} aria-hidden="true" />
    </span>
  );
}

/** Activities and stage changes, newest first as the API gives them (R50–R55). */
export function Timeline({
  items,
  showSource = false,
  onEdit,
  onDelete,
  onToggleDone,
  emptyMessage = "Nothing logged yet",
}: TimelineProps) {
  if (items.length === 0) return <EmptyState message={emptyMessage} />;
  return (
    <ul className="feed timeline" aria-label="Timeline">
      {items.map((item) => {
        const activity = item.activity;
        return (
          <li key={`${item.kind}-${item.id}`} data-kind={item.kind}>
            <EntryIcon type={item.type} toStage={item.toStage} />
            <div className="body">
              <div className="title">{entryTitle(item)}</div>
              <div className="meta">
                {showSource && (
                  <>
                    <Link to={sourcePath(item.source)}>{item.source.name}</Link>
                    {" · "}
                  </>
                )}
                <span className="num-text">{formatDateTime(item.at)}</span>
              </div>
              {activity?.followUpDate && (
                <label className={activity.done ? "follow-up done" : "follow-up"}>
                  <input
                    type="checkbox"
                    checked={activity.done}
                    disabled={!onToggleDone}
                    onChange={(event) => onToggleDone?.(activity, event.target.checked)}
                  />
                  Follow up {formatDateShort(activity.followUpDate)}
                  {activity.done ? " · Done" : ""}
                </label>
              )}
            </div>
            {activity && (onEdit || onDelete) && (
              <div className="entry-actions">
                {onEdit && (
                  <button type="button" className="link-button" onClick={() => onEdit(activity)}>
                    Edit
                  </button>
                )}
                {onDelete && (
                  <button type="button" className="link-button" onClick={() => onDelete(activity)}>
                    Delete
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
