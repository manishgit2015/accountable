import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useCreateActivity, useDeleteActivity, useOffline, useUpdateActivity } from "../api/queries";
import type { Activity, ActivityInput } from "../api/types";
import {
  FieldShell,
  FormError,
  TextAreaField,
  TextField,
  applyServerErrors,
  rules,
  zodResolver,
} from "../forms/fields";
import { ACTIVITY_TYPES } from "../lib/deals";
import { toInputDateTime, toIsoDateTime } from "../lib/format";
import { Button } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";
import { SidePanel } from "./SidePanel";
import { Timeline, type TimelineItem } from "./Timeline";

const schema = z.object({
  type: z.enum(["note", "call", "email"]),
  description: rules.description,
  occurredAt: rules.occurredAt,
  followUpDate: rules.followUpDate,
});
type Values = z.infer<typeof schema>;
const FIELDS = ["type", "description", "occurredAt", "followUpDate"] as const;

interface Props {
  /** Where a new activity is logged: exactly one of a contact or a deal (R13). */
  target?: { contactId: number } | { dealId: number };
  /** Edit this activity instead (R55). */
  activity?: Activity;
  onSaved?: (activity: Activity) => void;
  onCancel?: () => void;
}

function blank(): Values {
  return { type: "note", description: "", occurredAt: toInputDateTime(toIsoDateTime(new Date())), followUpDate: "" };
}

/** R53: type, description, when it happened (now by default, may be in the future) and a follow-up date. */
export function ActivityForm({ target, activity, onSaved, onCancel }: Props) {
  const create = useCreateActivity();
  const update = useUpdateActivity();
  const offline = useOffline();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: activity
      ? {
          type: activity.type,
          description: activity.description,
          occurredAt: toInputDateTime(activity.occurredAt),
          followUpDate: activity.followUpDate ?? "",
        }
      : blank(),
  });

  async function onSubmit(values: Values) {
    setFormError(null);
    const input: ActivityInput = {
      type: values.type,
      description: values.description.trim(),
      occurredAt: values.occurredAt.length === 16 ? `${values.occurredAt}:00` : values.occurredAt,
      followUpDate: values.followUpDate === "" ? null : values.followUpDate,
    };
    try {
      const saved = activity
        ? await update.mutateAsync({ id: activity.id, input })
        : await create.mutateAsync({ ...input, ...target });
      if (!activity) reset(blank());
      onSaved?.(saved);
    } catch (error) {
      setFormError(applyServerErrors(error, setError, FIELDS, "activity"));
    }
  }

  const saving = isSubmitting || create.isPending || update.isPending;
  return (
    <form className="form activity-form" onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Log activity">
      <FormError message={formError} />
      <div className="field-row">
        <FieldShell label="Type" error={errors.type?.message}>
          {(props) => (
            <select {...props} {...register("type")}>
              {ACTIVITY_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          )}
        </FieldShell>
        <TextField
          label="When it happened"
          type="datetime-local"
          error={errors.occurredAt?.message}
          {...register("occurredAt")}
        />
      </div>
      <TextAreaField label="Description" rows={3} error={errors.description?.message} {...register("description")} />
      <TextField
        label="Follow-up date (optional)"
        type="date"
        error={errors.followUpDate?.message}
        {...register("followUpDate")}
      />
      <div className="form-actions">
        {onCancel && <Button onClick={onCancel}>Cancel</Button>}
        <Button type="submit" variant="primary" disabled={saving || offline}>
          {saving ? "Saving..." : activity ? "Save changes" : "Log activity"}
        </Button>
      </div>
    </form>
  );
}

interface ActivityTimelineProps {
  items: TimelineItem[];
  showSource?: boolean;
  emptyMessage?: string;
}

/**
 * A record's timeline with its activity actions (R55): edit in a side panel, delete after asking,
 * and mark a follow-up done or not done. Stage changes have no actions.
 */
export function ActivityTimeline({ items, showSource, emptyMessage }: ActivityTimelineProps) {
  const update = useUpdateActivity();
  const remove = useDeleteActivity();
  const offline = useOffline();
  const [editing, setEditing] = useState<Activity | null>(null);
  const [deleting, setDeleting] = useState<Activity | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // A ticked or unticked follow-up shows its new state at once; the refetch then confirms it.
  const [pendingDone, setPendingDone] = useState<Map<number, boolean>>(() => new Map());
  const shown = items.map((item) => {
    const done = item.activity ? pendingDone.get(item.activity.id) : undefined;
    return item.activity && done !== undefined && done !== item.activity.done
      ? { ...item, activity: { ...item.activity, done } }
      : item;
  });

  function forget(id: number) {
    setPendingDone((m) => {
      const next = new Map(m);
      next.delete(id);
      return next;
    });
  }

  return (
    <>
      <FormError message={message} />
      <Timeline
        items={shown}
        showSource={showSource}
        emptyMessage={emptyMessage}
        onEdit={setEditing}
        onDelete={setDeleting}
        onToggleDone={(activity, done) => {
          if (offline) return;
          setMessage(null);
          setPendingDone((m) => new Map(m).set(activity.id, done));
          update.mutate(
            { id: activity.id, input: { done } },
            {
              onSuccess: () => forget(activity.id),
              onError: () => {
                forget(activity.id);
                setMessage("Couldn't save the follow-up. Check the app is still running and try again.");
              },
            },
          );
        }}
      />
      <SidePanel open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} title="Edit activity">
        {editing && (
          <ActivityForm activity={editing} onSaved={() => setEditing(null)} onCancel={() => setEditing(null)} />
        )}
      </SidePanel>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            remove.reset();
            setDeleting(null);
          }
        }}
        title="Delete this activity?"
        description={deleting ? `"${deleting.description}" will be deleted. This can't be undone.` : null}
        busy={remove.isPending}
        error={remove.isError ? "Couldn't delete the activity. Check the app is still running and try again." : null}
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />
    </>
  );
}
