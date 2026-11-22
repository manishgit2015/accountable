import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

import { useDeleteImpact, useDeleteRecord, useOffline } from "../api/queries";
import type { RecordKind } from "../api/types";

import { Button } from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "Delete Acme Ltd?" */
  title: string;
  /** What happens to the linked records, with the server's counts (R30). Null while they load. */
  description: ReactNode | null;
  confirmLabel?: string;
  /** Shown instead of the description when the counts couldn't be read. */
  error?: string | null;
  busy?: boolean;
  onConfirm: () => void;
}

/** A centered delete confirmation (R30, spec 3.9). Nothing is deleted until "Delete" is pressed. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  error,
  busy = false,
  onConfirm,
}: ConfirmDialogProps) {
  const ready = description !== null && !error;
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="confirm-dialog" role="alertdialog">
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description asChild>
            <div className={error ? "error-text" : "muted"}>{error ?? description ?? "Checking linked records..."}</div>
          </Dialog.Description>
          <div className="dialog-actions">
            <Dialog.Close asChild>
              <Button>Cancel</Button>
            </Dialog.Close>
            <Button variant="destructive" disabled={!ready || busy} onClick={onConfirm}>
              {busy ? "Deleting..." : confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** R30–R33: what deleting does to the linked records, worded from the server's counts. */
export function impactText(kind: RecordKind, impact: Record<string, number>): string {
  const n = (key: string) => impact[key] ?? 0;
  if (kind === "organization") {
    return `Its ${count(n("contactsKept"), "contact", "contacts")} and ${count(n("dealsKept"), "deal", "deals")} will be kept, with no organization. This can't be undone.`;
  }
  if (kind === "contact") {
    return `Their ${count(n("dealsKept"), "deal", "deals")} will be kept, with no main contact. Their ${count(n("activitiesDeleted"), "activity", "activities")} will be deleted. This can't be undone.`;
  }
  return `Its ${count(n("activitiesDeleted"), "activity", "activities")} and ${count(n("stageChangesDeleted"), "stage change", "stage changes")} will be deleted. This can't be undone.`;
}

interface DeleteRecordDialogProps {
  kind: RecordKind;
  /** The record to delete; the dialog is open while it's set. */
  record: { id: number; name: string } | null;
  onClose: () => void;
  onDeleted?: () => void;
}

/** The delete dialog for an organization, contact or deal, with the server's counts read on opening (R30). */
export function DeleteRecordDialog({ kind, record, onClose, onDeleted }: DeleteRecordDialogProps) {
  const impact = useDeleteImpact(kind, record?.id ?? null);
  const remove = useDeleteRecord();
  const offline = useOffline();
  const description = impact.data ? impactText(kind, impact.data as unknown as Record<string, number>) : null;
  const error = remove.isError
    ? "Couldn't delete it. Check the app is still running and try again."
    : impact.isError
      ? "Couldn't check the linked records. Check the app is still running and try again."
      : null;
  return (
    <ConfirmDialog
      open={record !== null}
      onOpenChange={(open) => {
        if (!open) {
          remove.reset();
          onClose();
        }
      }}
      title={record ? `Delete ${record.name}?` : ""}
      description={description}
      error={error}
      busy={remove.isPending || offline}
      onConfirm={() => {
        if (!record) return;
        remove.mutate(
          { kind, id: record.id },
          {
            onSuccess: () => {
              remove.reset();
              onClose();
              onDeleted?.();
            },
          },
        );
      }}
    />
  );
}
