// Deal logic shared by pages: the stage list (mirrored once from backend/app/rules.py), late,
// expected revenue, the greeting and initials. Display only: the API's figures are authoritative.
import { toIsoDate } from "./format";

export type Stage = "new" | "qualified" | "proposal" | "negotiation" | "won" | "lost";
export type ContactStatus = "lead" | "qualified" | "customer";
export type ActivityType = "note" | "call" | "email";

export interface StageInfo {
  key: Stage;
  label: string;
  /** The usual probability (R14). */
  probability: number;
  open: boolean;
  /** A CSS custom property from tokens.css (spec 3.9 stage colors). */
  color: string;
}

/** The six stages in board order (R14, spec 3.9). The only stage list in the frontend. */
export const STAGES: readonly StageInfo[] = [
  { key: "new", label: "New", probability: 5, open: true, color: "var(--stage-new)" },
  { key: "qualified", label: "Qualified", probability: 20, open: true, color: "var(--stage-qualified)" },
  { key: "proposal", label: "Proposal", probability: 40, open: true, color: "var(--stage-proposal)" },
  { key: "negotiation", label: "Negotiation", probability: 70, open: true, color: "var(--stage-negotiation)" },
  { key: "won", label: "Won", probability: 100, open: false, color: "var(--stage-won)" },
  { key: "lost", label: "Lost", probability: 0, open: false, color: "var(--stage-lost)" },
];

export const OPEN_STAGES: readonly StageInfo[] = STAGES.filter((s) => s.open);

export function stageInfo(stage: Stage): StageInfo {
  const info = STAGES.find((s) => s.key === stage);
  if (!info) throw new Error(`Unknown stage: ${stage}`);
  return info;
}

export function stageLabel(stage: Stage): string {
  return stageInfo(stage).label;
}

export function isOpenStage(stage: Stage): boolean {
  return stageInfo(stage).open;
}

/** R14: the usual probability of a stage. */
export function usualProbability(stage: Stage): number {
  return stageInfo(stage).probability;
}

export const CONTACT_STATUSES: readonly { key: ContactStatus; label: string }[] = [
  { key: "lead", label: "Lead" },
  { key: "qualified", label: "Qualified" },
  { key: "customer", label: "Customer" },
];

export function statusLabel(status: ContactStatus): string {
  return CONTACT_STATUSES.find((s) => s.key === status)?.label ?? status;
}

export const ACTIVITY_TYPES: readonly { key: ActivityType; label: string }[] = [
  { key: "note", label: "Note" },
  { key: "call", label: "Call" },
  { key: "email", label: "Email" },
];

/** R19: late when open and the close date is before today. */
export function isLate(deal: { stage: Stage; closeDate: string }, today: Date = new Date()): boolean {
  return isOpenStage(deal.stage) && deal.closeDate < toIsoDate(today);
}

/** R20: value × probability ÷ 100, rounded to the nearest dollar (halves up, as the backend). */
export function expectedRevenue(value: number, probability: number): number {
  return Math.floor((value * probability) / 100 + 0.5);
}

/** R79: "Good morning" before 12:00, "Good afternoon" to 17:59, "Good evening" from 18:00. */
export function greeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** "2 follow-ups overdue, 3 deals running late", or "Nothing overdue" (R79). */
export function summaryLine(overdueFollowUps: number, lateDeals: number): string {
  const parts: string[] = [];
  if (overdueFollowUps > 0) {
    parts.push(`${overdueFollowUps} ${overdueFollowUps === 1 ? "follow-up" : "follow-ups"} overdue`);
  }
  if (lateDeals > 0) parts.push(`${lateDeals} ${lateDeals === 1 ? "deal" : "deals"} running late`);
  return parts.length ? parts.join(", ") : "Nothing overdue";
}

/** "NL" for "Northwind Logistics", "BO" for "Bramble & Oak". */
export function initials(name: string | null | undefined): string {
  if (!name) return "–";
  const words = name.split(/[\s&,]+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

/** The first moment of this calendar month, local time: Won and Lost columns hold deals closed since (R60). */
export function monthStart(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/** R60: closed this calendar month, by closed_at (local time). */
export function closedThisMonth(deal: { closedAt: string | null }, now: Date = new Date()): boolean {
  // The same test as the backend's board column: closed_at on or after the 1st of this month.
  if (!deal.closedAt) return false;
  return deal.closedAt.slice(0, 10) >= toIsoDate(monthStart(now));
}
