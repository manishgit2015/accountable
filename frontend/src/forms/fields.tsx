// Shared form pieces: labelled fields with their messages, the R21 rules as Zod schemas, a Zod
// resolver for React Hook Form, and putting the server's field messages on the form (R45, R48).
import { useId, type ComponentPropsWithRef, type ReactNode } from "react";
import type { FieldValues, Path, Resolver, UseFormSetError } from "react-hook-form";
import { z } from "zod";

import { ApiError } from "../api/client";

// R21 field rules, mirrored from backend/app/schemas.py for fast feedback. The server checks them again.

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE = /^[0-9 +().-]*$/;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

const maxText = (what: string, maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum, `Keep the ${what} to ${maximum.toLocaleString("en-US")} characters or fewer.`);

export const rules = {
  name: z.string().trim().min(1, "Enter a name.").max(200, "Keep the name to 200 characters or fewer."),
  email: z
    .string()
    .trim()
    .max(254, "Keep the email to 254 characters or fewer.")
    .refine((v) => v === "" || EMAIL.test(v), "Enter an email like name@example.com."),
  phone: z
    .string()
    .trim()
    .max(40, "Keep the phone number to 40 characters or fewer.")
    .refine((v) => PHONE.test(v), "Use only digits, spaces and + ( ) - . in a phone number."),
  website: z
    .string()
    .trim()
    .max(2048, "Keep the website to 2,048 characters or fewer.")
    .refine(
      (v) => v === "" || /^https?:\/\//i.test(v) || !SCHEME.test(v),
      "Enter a website like example.com or https://example.com.",
    ),
  industry: maxText("industry", 100),
  jobTitle: maxText("job title", 100),
  notes: maxText("notes", 5000),
  description: z
    .string()
    .trim()
    .min(1, "Enter a description.")
    .max(5000, "Keep the description to 5,000 characters or fewer."),
  value: z
    .string()
    .trim()
    .min(1, "Enter a value.")
    .refine(
      (v) => /^\d+$/.test(v) && Number(v) <= 1_000_000_000,
      "Enter a whole number of dollars from 0 to 1,000,000,000.",
    ),
  probability: z
    .string()
    .trim()
    .min(1, "Enter a probability.")
    .refine((v) => /^\d+$/.test(v) && Number(v) <= 100, "Enter a whole-number percentage from 0 to 100."),
  closeDate: z.string().min(1, "Enter a close date.").refine(isRealDate, "Enter a close date like 2026-12-31."),
  followUpDate: z.string().refine((v) => v === "" || isRealDate(v), "Enter a follow-up date like 2026-12-31."),
  occurredAt: z.string().min(1, "Enter when it happened."),
};

function isRealDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** Blank after trimming counts as empty (R21): sent as null. */
export function optional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** A React Hook Form resolver for a Zod schema (no extra package: a few lines are enough). */
export function zodResolver<T extends FieldValues>(schema: z.ZodType<T>): Resolver<T> {
  return async (values) => {
    const result = schema.safeParse(values);
    if (result.success) return { values: result.data, errors: {} };
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".");
      errors[key] ??= { type: issue.code, message: issue.message };
    }
    return { values: {}, errors: errors as never };
  };
}

export const SAVE_FAILED = "Couldn't save. Check the app is still running and try again.";

/**
 * R48: put the server's messages next to the fields and keep what was typed. Returns the message for
 * the top of the form, with the reference when there is one (OBS-3).
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fieldNames: readonly string[],
  what: string,
): string {
  if (!(error instanceof ApiError)) return `Couldn't save the ${what}. Check the app is still running and try again.`;
  let unplaced = false;
  for (const [field, message] of Object.entries(error.fields)) {
    if (fieldNames.includes(field)) setError(field as Path<T>, { type: "server", message });
    else unplaced = true;
  }
  if (error.code === "validation_failed" && !unplaced) return "Check the highlighted fields.";
  const base =
    error.code === "validation_failed"
      ? error.message
      : error.code === "unreachable" || error.code === "timeout" || error.code === "busy"
        ? error.message
        : `Couldn't save the ${what}. Check the app is still running and try again.`;
  return error.reference ? `${base} ${error.reference}` : base;
}

interface FieldShellProps {
  label: string;
  error?: string;
  hint?: string;
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => ReactNode;
}

/** A label, the control, and its message underneath (R45). */
export function FieldShell({ label, error, hint, children }: FieldShellProps) {
  const id = useId();
  const messageId = `${id}-message`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error || hint ? messageId : undefined,
      })}
      {error ? (
        <p className="field-error" id={messageId}>
          {error}
        </p>
      ) : (
        hint && (
          <p className="field-hint" id={messageId}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function TextField({
  label,
  error,
  hint,
  ...input
}: { label: string; error?: string; hint?: string } & ComponentPropsWithRef<"input">) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      {(props) => <input {...input} {...props} />}
    </FieldShell>
  );
}

export function TextAreaField({
  label,
  error,
  ...input
}: { label: string; error?: string } & ComponentPropsWithRef<"textarea">) {
  return (
    <FieldShell label={label} error={error}>
      {(props) => <textarea rows={4} {...input} {...props} />}
    </FieldShell>
  );
}

/** The message at the top of a form when a save is refused or fails. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="form-error" role="alert">
      {message}
    </p>
  );
}
