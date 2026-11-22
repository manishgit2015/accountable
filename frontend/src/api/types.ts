// TypeScript types for every API shape in spec 5, written once by hand from backend/app/schemas.py.
// Field names are the camelCase form of the API's snake_case (ENG-6); client.ts translates them.
import type { ActivityType, ContactStatus, Stage } from "../lib/deals";

export type { ActivityType, ContactStatus, Stage };

/** "YYYY-MM-DD" */
export type IsoDate = string;
/** "YYYY-MM-DDTHH:MM:SS", local time, no time zone (ADR-013) */
export type IsoDateTime = string;

export interface Organization {
  id: number;
  name: string;
  website: string | null;
  industry: string | null;
  notes: string | null;
  contactCount: number;
  openDealCount: number;
  openValue: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface OrganizationInput {
  name: string;
  website?: string | null;
  industry?: string | null;
  notes?: string | null;
}

export interface Contact {
  id: number;
  organizationId: number | null;
  organizationName: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  status: ContactStatus;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface ContactInput {
  name: string;
  /** Required on create (R11). Left out of a PATCH, a cleared link stays cleared (R34). */
  organizationId?: number | null;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  status?: ContactStatus;
}

export interface Deal {
  id: number;
  organizationId: number | null;
  organizationName: string | null;
  contactId: number | null;
  contactName: string | null;
  name: string;
  stage: Stage;
  value: number;
  probability: number;
  expectedRevenue: number;
  closeDate: IsoDate;
  isLate: boolean;
  position: number;
  closedAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface DealInput {
  name?: string;
  organizationId?: number | null;
  contactId?: number | null;
  stage?: Stage;
  value?: number;
  closeDate?: IsoDate;
  /** Left out on create: the stage's usual one (R15). */
  probability?: number;
}

export interface DealMove {
  stage: Stage;
  /** The card above the drop point, or null at the top. */
  beforeId: number | null;
  /** The card below the drop point, or null at the bottom. */
  afterId: number | null;
}

export interface MoveResult {
  deal: Deal;
  renumbered: Deal[];
}

export interface Activity {
  id: number;
  type: ActivityType;
  contactId: number | null;
  dealId: number | null;
  description: string;
  occurredAt: IsoDateTime;
  followUpDate: IsoDate | null;
  done: boolean;
}

export interface ActivityInput {
  type?: ActivityType;
  description?: string;
  /** Exactly one of contactId and dealId, on create only. */
  contactId?: number;
  dealId?: number;
  /** Left out on create: now (R13). */
  occurredAt?: IsoDateTime;
  followUpDate?: IsoDate | null;
  done?: boolean;
}

export interface Source {
  kind: "deal" | "contact";
  id: number;
  name: string;
}

export interface TimelineEntry {
  kind: "activity" | "stage_change";
  id: number;
  /** The activity type, or null for a stage change. */
  type: ActivityType | null;
  fromStage: Stage | null;
  toStage: Stage | null;
  /** Null for a stage change. */
  description: string | null;
  at: IsoDateTime;
  source: Source;
}

export interface OrganizationDeleteImpact {
  contactsKept: number;
  dealsKept: number;
}

export interface ContactDeleteImpact {
  dealsKept: number;
  activitiesDeleted: number;
}

export interface DealDeleteImpact {
  activitiesDeleted: number;
  stageChangesDeleted: number;
}

export interface FollowUp extends Activity {
  source: Source;
}

export interface Dashboard {
  today: IsoDate;
  summary: {
    openValue: number;
    expectedRevenue: number;
    wonThisMonth: { value: number; count: number };
    winRate: { won: number; lost: number; percent: number | null };
  };
  /** Always 12, oldest first. */
  months: { month: string; revenueWon: number; won: number; lost: number }[];
  /** New to Won. */
  funnel: { stage: Stage; value: number }[];
  openByStage: { stage: Stage; count: number; value: number; expected: number }[];
  followUps: { overdue: FollowUp[]; today: FollowUp[]; next7Days: FollowUp[]; laterCount: number };
  recent: TimelineEntry[];
  counts: { overdueFollowUps: number; lateDeals: number };
}

/** The three record types with a page, a timeline and delete-impact. */
export type RecordKind = "organization" | "contact" | "deal";
