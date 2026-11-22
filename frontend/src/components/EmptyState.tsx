import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ApiError } from "../api/client";

/** A short empty-state line in Instrument Serif italic, with an optional action (R46, R78). */
export function EmptyState({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      <p className="empty-line">{message}</p>
      {children && <div className="empty-actions">{children}</div>}
    </div>
  );
}

/** The message for a read that failed, with its reference (OBS-3). */
export function errorMessage(error: unknown, what: string): string {
  if (error instanceof ApiError) {
    const base =
      error.code === "unreachable" || error.code === "timeout" || error.code === "busy"
        ? error.message
        : `Couldn't load the ${what}. Check the app is still running and try again.`;
    return error.reference ? `${base} ${error.reference}` : base;
  }
  return `Couldn't load the ${what}. Check the app is still running and try again.`;
}

/** Loading and error states for a query; the children get the data once it's there. */
export function QueryState<T>({
  query,
  what,
  children,
}: {
  query: Pick<UseQueryResult<T>, "data" | "error" | "isPending">;
  what: string;
  children: (data: T) => ReactNode;
}) {
  if (query.data !== undefined) return <>{children(query.data)}</>;
  if (query.error) {
    return (
      <div className="panel">
        <p className="error-text" role="alert">
          {errorMessage(query.error, what)}
        </p>
      </div>
    );
  }
  return (
    <div className="panel loading" aria-busy="true">
      <p className="muted">Loading {what}...</p>
    </div>
  );
}
