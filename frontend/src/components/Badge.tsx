import type { ReactNode } from "react";

export type BadgeKind =
  | "new"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost"
  | "lead"
  | "customer"
  | "late";

/** A pill badge. Qualified, Lost and Late use the darker fills with white text (ADR-017). */
export function Badge({ kind, children }: { kind: BadgeKind; children: ReactNode }) {
  return <span className={`badge badge-${kind}`}>{children}</span>;
}
