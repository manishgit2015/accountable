// Query and mutation hooks for every endpoint (spec 5, 7.2). Pages use these, never apiRequest directly.
//
// - Reads are cached by TanStack Query and retried once (not for a 404: the record is gone). Changes are
//   never retried (REL-5).
// - After any save, every query that shows records is refetched: lists, records, timelines and the
//   dashboard (spec 7.2). Names, counts and totals appear on every page, so a change to one record can
//   show anywhere; refetching only the queries on screen keeps this cheap.
// - A pipeline drop updates the deals cache at once, calls /move, and puts the cache back if it fails
//   (R64, REL-8). A 409 reloads the board (REL-11).
// - The connection state behind the offline banner (REL-7) is kept here, from every query's outcome.
import {
  hashKey,
  MutationCache,
  QueryCache,
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { useMemo, useSyncExternalStore } from "react";

import { usualProbability } from "../lib/deals";
import { toIsoDateTime } from "../lib/format";
import { ApiError, apiRequest, getHealth } from "./client";
import type {
  Me,
  Activity,
  ActivityInput,
  Contact,
  ContactDeleteImpact,
  ContactInput,
  Dashboard,
  Deal,
  DealDeleteImpact,
  DealInput,
  DealMove,
  MoveResult,
  Organization,
  OrganizationDeleteImpact,
  OrganizationInput,
  RecordKind,
  TimelineEntry,
} from "./types";

// Query keys -----------------------------------------------------------------------------------------

const PATHS: Record<RecordKind, string> = {
  organization: "/api/organizations",
  contact: "/api/contacts",
  deal: "/api/deals",
};

export const keys = {
  organizations: ["organizations"] as const,
  organization: (id: number) => ["organizations", id] as const,
  contacts: ["contacts"] as const,
  contact: (id: number) => ["contacts", id] as const,
  deals: ["deals"] as const,
  deal: (id: number) => ["deals", id] as const,
  activities: ["activities"] as const,
  timeline: (kind: RecordKind, id: number) => ["timeline", kind, id] as const,
  deleteImpact: (kind: RecordKind, id: number) => ["delete-impact", kind, id] as const,
  dashboard: ["dashboard"] as const,
  health: ["health"] as const,
  me: ["me"] as const,
};

/** Every query that shows record data. Delete-impact is left out: it's read fresh when a dialog opens. */
const RECORD_ROOTS: QueryKey[] = [
  keys.organizations,
  keys.contacts,
  keys.deals,
  keys.activities,
  ["timeline"],
  keys.dashboard,
];

/** Spec 7.2: after a save, refetch the lists, records, timelines and the dashboard. */
export function refetchRecords(client: QueryClient): Promise<void> {
  return Promise.all(RECORD_ROOTS.map((queryKey) => client.invalidateQueries({ queryKey }))).then(() => undefined);
}

// Connection state (REL-7) ---------------------------------------------------------------------------

type Listener = () => void;
let offline = false;
const listeners = new Set<Listener>();

function isConnectionError(error: unknown): boolean {
  return error instanceof ApiError && (error.code === "unreachable" || error.code === "timeout");
}

export function setOffline(value: boolean): void {
  if (offline === value) return;
  offline = value;
  listeners.forEach((listener) => listener());
}

/** True while the backend can't be reached. Saving is blocked until it's back (REL-7). */
export function useOffline(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => offline,
  );
}

/** While offline, ask the backend every few seconds whether it's back. */
export function useHealthWhileOffline(): void {
  const isOffline = useOffline();
  useQuery({
    queryKey: keys.health,
    queryFn: ({ signal }) => getHealth(signal),
    enabled: isOffline,
    refetchInterval: isOffline ? 3000 : false,
    retry: false,
  });
}

/** The app's query client: reads retried once (not a 404), changes never (REL-5). */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        if (isConnectionError(error)) setOffline(true);
      },
      onSuccess: () => setOffline(false),
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        if (isConnectionError(error)) setOffline(true);
      },
      onSuccess: () => setOffline(false),
    }),
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => failureCount < 1 && !(error instanceof ApiError && error.status === 404),
      },
      mutations: { retry: 0 },
    },
  });
}

// Reads ------------------------------------------------------------------------------------------------

/** Who's signed in (R105, R106). */
export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: ({ signal }) => apiRequest<Me>("GET", "/api/me", { signal }),
    staleTime: Infinity,
  });
}

export function useOrganizations() {
  return useQuery({
    queryKey: keys.organizations,
    queryFn: ({ signal }) => apiRequest<Organization[]>("GET", PATHS.organization, { signal }),
  });
}

export function useOrganization(id: number) {
  return useQuery({
    queryKey: keys.organization(id),
    queryFn: ({ signal }) => apiRequest<Organization>("GET", `${PATHS.organization}/${id}`, { signal }),
  });
}

export function useContacts() {
  return useQuery({
    queryKey: keys.contacts,
    queryFn: ({ signal }) => apiRequest<Contact[]>("GET", PATHS.contact, { signal }),
  });
}

export function useContact(id: number) {
  return useQuery({
    queryKey: keys.contact(id),
    queryFn: ({ signal }) => apiRequest<Contact>("GET", `${PATHS.contact}/${id}`, { signal }),
  });
}

export function useDeals() {
  return useQuery({
    queryKey: keys.deals,
    queryFn: ({ signal }) => apiRequest<Deal[]>("GET", PATHS.deal, { signal }),
  });
}

export function useDeal(id: number) {
  return useQuery({
    queryKey: keys.deal(id),
    queryFn: ({ signal }) => apiRequest<Deal>("GET", `${PATHS.deal}/${id}`, { signal }),
  });
}

export function useActivities() {
  return useQuery({
    queryKey: keys.activities,
    queryFn: ({ signal }) => apiRequest<Activity[]>("GET", "/api/activities", { signal }),
  });
}

export function useTimeline(kind: RecordKind, id: number, enabled = true) {
  return useQuery({
    queryKey: keys.timeline(kind, id),
    queryFn: ({ signal }) => apiRequest<TimelineEntry[]>("GET", `${PATHS[kind]}/${id}/timeline`, { signal }),
    enabled,
  });
}

type ImpactOf<K extends RecordKind> = K extends "organization"
  ? OrganizationDeleteImpact
  : K extends "contact"
    ? ContactDeleteImpact
    : DealDeleteImpact;

/** R30: the counts come from the server when the dialog opens, so they're never cached. */
export function useDeleteImpact<K extends RecordKind>(kind: K, id: number | null) {
  return useQuery({
    queryKey: keys.deleteImpact(kind, id ?? 0),
    queryFn: ({ signal }) => apiRequest<ImpactOf<K>>("GET", `${PATHS[kind]}/${id}/delete-impact`, { signal }),
    enabled: id !== null,
    gcTime: 0,
    staleTime: 0,
  });
}

export function useDashboard() {
  return useQuery({
    queryKey: keys.dashboard,
    queryFn: ({ signal }) => apiRequest<Dashboard>("GET", "/api/dashboard", { signal }),
  });
}

// Changes ------------------------------------------------------------------------------------------------

function useSave<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => refetchRecords(client),
  });
}

export function useCreateOrganization() {
  return useSave((input: OrganizationInput) => apiRequest<Organization>("POST", PATHS.organization, { body: input }));
}

export function useUpdateOrganization() {
  return useSave(({ id, input }: { id: number; input: Partial<OrganizationInput> }) =>
    apiRequest<Organization>("PATCH", `${PATHS.organization}/${id}`, { body: input }),
  );
}

export function useCreateContact() {
  return useSave((input: ContactInput) => apiRequest<Contact>("POST", PATHS.contact, { body: input }));
}

export function useUpdateContact() {
  return useSave(({ id, input }: { id: number; input: Partial<ContactInput> }) =>
    apiRequest<Contact>("PATCH", `${PATHS.contact}/${id}`, { body: input }),
  );
}

export function useCreateDeal() {
  return useSave((input: DealInput) => apiRequest<Deal>("POST", PATHS.deal, { body: input }));
}

export function useUpdateDeal() {
  return useSave(({ id, input }: { id: number; input: DealInput }) =>
    apiRequest<Deal>("PATCH", `${PATHS.deal}/${id}`, { body: input }),
  );
}

export function useCreateActivity() {
  return useSave((input: ActivityInput) => apiRequest<Activity>("POST", "/api/activities", { body: input }));
}

export function useUpdateActivity() {
  return useSave(({ id, input }: { id: number; input: ActivityInput }) =>
    apiRequest<Activity>("PATCH", `/api/activities/${id}`, { body: input }),
  );
}

/** REL-5: a DELETE of something already gone (404) counts as done. */
async function deleteRecord(path: string): Promise<void> {
  try {
    await apiRequest<undefined>("DELETE", path);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return;
    throw error;
  }
}

const RECORD_KEY: Record<RecordKind, (id: number) => QueryKey> = {
  organization: keys.organization,
  contact: keys.contact,
  deal: keys.deal,
};

/**
 * Like the other saves, but the deleted record's own queries (the record, its timeline, its delete-impact)
 * are left out of the refetch. When the delete is made from that record's page, refetching them would answer
 * 404 (a console error, R7) and swap the page for "no longer exists" before the dialog's onDeleted could
 * take the user back to the list (found in the V-M01 walkthrough).
 */
export function useDeleteRecord() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, id }: { kind: RecordKind; id: number }) => deleteRecord(`${PATHS[kind]}/${id}`),
    onSuccess: (_result, { kind, id }) => {
      const own = new Set([RECORD_KEY[kind](id), keys.timeline(kind, id), keys.deleteImpact(kind, id)].map(hashKey));
      return Promise.all(
        RECORD_ROOTS.map((queryKey) =>
          client.invalidateQueries({ queryKey, predicate: (query) => !own.has(query.queryHash) }),
        ),
      ).then(() => undefined);
    },
  });
}

export function useDeleteActivity() {
  return useSave((id: number) => deleteRecord(`/api/activities/${id}`));
}

// The pipeline's optimistic move (R63, R64, REL-8, REL-11) --------------------------------------------

/** Where a drop puts a card before the server answers: the midpoint of its neighbours (spec 6.4). */
export function optimisticMove(deals: Deal[], dealId: number, move: DealMove, now: Date = new Date()): Deal[] {
  const before = move.beforeId === null ? undefined : deals.find((d) => d.id === move.beforeId);
  const after = move.afterId === null ? undefined : deals.find((d) => d.id === move.afterId);
  let position: number;
  if (before && after) position = (before.position + after.position) / 2;
  else if (after) position = after.position - 1;
  else if (before) position = before.position + 1;
  else position = 1;
  return deals.map((deal) => {
    if (deal.id !== dealId) return deal;
    if (deal.stage === move.stage) return { ...deal, position };
    // The stage effects, shown at once; the server's answer replaces them (R15, R16).
    const closing = move.stage === "won" || move.stage === "lost";
    const probability = usualProbability(move.stage);
    return {
      ...deal,
      stage: move.stage,
      position,
      probability,
      expectedRevenue: Math.floor((deal.value * probability) / 100 + 0.5),
      closedAt: closing ? toIsoDateTime(now) : deal.closedAt,
      isLate: closing ? false : deal.isLate,
    };
  });
}

export const MOVE_FAILED = "Couldn't move the deal. Check the app is still running and try again.";

/**
 * Move a deal on the board. `onFailure` gets the message to show: the board is put back first, and
 * on a 409 `stale_position` it reloads from the server ("The board changed. Try again.").
 */
export function useMoveDeal(onFailure: (message: string) => void) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, move }: { id: number; move: DealMove }) =>
      apiRequest<MoveResult>("POST", `${PATHS.deal}/${id}/move`, { body: move }),
    onMutate: async ({ id, move }) => {
      await client.cancelQueries({ queryKey: keys.deals, exact: true });
      const previous = client.getQueryData<Deal[]>(keys.deals);
      if (previous) client.setQueryData<Deal[]>(keys.deals, optimisticMove(previous, id, move));
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) client.setQueryData(keys.deals, context.previous);
      if (error instanceof ApiError && error.code === "stale_position") {
        void client.invalidateQueries({ queryKey: keys.deals });
        onFailure(error.message);
        return;
      }
      const message = error instanceof ApiError && error.code !== "internal" ? error.message : MOVE_FAILED;
      onFailure(message);
    },
    onSuccess: (result) => {
      // The server's answer replaces the optimistic one: its positions, probability and totals win.
      const changed = new Map([result.deal, ...result.renumbered].map((deal) => [deal.id, deal]));
      client.setQueryData<Deal[]>(keys.deals, (deals) => deals?.map((deal) => changed.get(deal.id) ?? deal));
      void refetchRecords(client);
    },
  });
}

// Timelines with their activities --------------------------------------------------------------------------

/**
 * A record's timeline, with each activity entry's full activity attached, so the page can show its
 * follow-up and done flag (R55). The timeline shape has neither, so they come from the activity list.
 */
export function useTimelineItems(kind: RecordKind, id: number, enabled = true) {
  const timeline = useTimeline(kind, id, enabled);
  const activities = useActivities();
  const items = useMemo(() => {
    const byId = new Map((activities.data ?? []).map((activity) => [activity.id, activity]));
    return (timeline.data ?? []).map((entry) =>
      entry.kind === "activity" ? { ...entry, activity: byId.get(entry.id) } : entry,
    );
  }, [timeline.data, activities.data]);
  const isPending = timeline.isPending || activities.isPending;
  const error = timeline.error ?? activities.error;
  // The same shape as a query's result, for QueryState.
  return { data: isPending || error ? undefined : items, isPending, error };
}
