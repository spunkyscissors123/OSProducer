import { addDays, diffDays } from "./dates";
import type { Prospect, TaskPriority } from "../types";

export const RENEWAL_WINDOWS = [30, 60, 90, 120] as const;
export type RenewalWindow = (typeof RENEWAL_WINDOWS)[number];

/** Special offset key for a single catch-up task when the planned outreach window has already passed. */
export const CATCH_UP_OFFSET = -1;

export interface PlannedRenewalTask {
  title: string;
  description: string | null;
  due_date: string;
  priority: TaskPriority;
  offset_days: number;
}

/** Days until the renewal date, or null when the renewal date is unknown. */
export function daysUntilRenewal(renewalDate: string | null, todayIso: string): number | null {
  return renewalDate ? diffDays(todayIso, renewalDate) : null;
}

/** Smallest window (30/60/90/120) containing the renewal, or null if outside 120 days / passed / unknown. */
export function renewalWindow(renewalDate: string | null, todayIso: string): RenewalWindow | null {
  const d = daysUntilRenewal(renewalDate, todayIso);
  if (d === null || d < 0) return null;
  return RENEWAL_WINDOWS.find((w) => d <= w) ?? null;
}

function priorityFor(offset: number): TaskPriority {
  if (offset <= 30) return "high";
  if (offset <= 60) return "medium";
  return "low";
}

const OFFSET_COPY: Record<number, string> = {
  120: "Initial renewal outreach — introduce yourself and request a meeting",
  90: "Discovery — gather exposures, loss runs and current schedule",
  60: "Market the account — submissions to carriers",
  30: "Present proposal before renewal",
};

/**
 * Builds the renewal outreach plan for a prospect.
 * - Unknown renewal date → no tasks (we never invent a date).
 * - Renewal already passed → no tasks (user must confirm a new date).
 * - Offsets whose due date is already in the past are skipped; if any were skipped and the renewal
 *   is still ahead, one catch-up task due today is added so the outreach isn't silently lost.
 * Output is deterministic, so re-running produces the same (offset, cycle) keys — the database's
 * unique index then prevents duplicates.
 */
export function planRenewalTasks(params: {
  businessName: string;
  renewalDate: string | null;
  renewalStatus: Prospect["renewal_date_status"];
  offsets: number[];
  todayIso: string;
}): PlannedRenewalTask[] {
  const { businessName, renewalDate, renewalStatus, todayIso } = params;
  if (!renewalDate || renewalStatus === "unknown") return [];
  const daysLeft = diffDays(todayIso, renewalDate);
  if (daysLeft < 0) return [];

  const offsets = [...new Set(params.offsets.filter((o) => Number.isInteger(o) && o > 0 && o <= 365))].sort((a, b) => b - a);
  const estimateNote = renewalStatus === "estimated" ? " (renewal date is an ESTIMATE — confirm with the prospect)" : "";
  const tasks: PlannedRenewalTask[] = [];
  let skipped = 0;

  for (const offset of offsets) {
    const due = addDays(renewalDate, -offset);
    if (due < todayIso) {
      skipped++;
      continue;
    }
    tasks.push({
      title: `${offset}-day renewal outreach: ${businessName}`,
      description: `${OFFSET_COPY[offset] ?? `Renewal touchpoint ${offset} days before renewal`}. Renewal ${renewalDate}${estimateNote}.`,
      due_date: due,
      priority: priorityFor(offset),
      offset_days: offset,
    });
  }

  if (skipped > 0) {
    tasks.push({
      title: `Catch-up renewal outreach: ${businessName} (renews in ${daysLeft} days)`,
      description: `${skipped} planned touchpoint(s) fell before today. Reach out now. Renewal ${renewalDate}${estimateNote}.`,
      due_date: todayIso,
      priority: "high",
      offset_days: CATCH_UP_OFFSET,
    });
  }

  return tasks.sort((a, b) => a.due_date.localeCompare(b.due_date));
}

export interface RenewalGroups<T> {
  d30: T[];
  d60: T[];
  d90: T[];
  d120: T[];
  passed: T[];
  unknown: T[];
}

export function groupByRenewalWindow<T extends Pick<Prospect, "renewal_date">>(items: T[], todayIso: string): RenewalGroups<T> {
  const g: RenewalGroups<T> = { d30: [], d60: [], d90: [], d120: [], passed: [], unknown: [] };
  for (const p of items) {
    const d = daysUntilRenewal(p.renewal_date, todayIso);
    if (d === null) g.unknown.push(p);
    else if (d < 0) g.passed.push(p);
    else if (d <= 30) g.d30.push(p);
    else if (d <= 60) g.d60.push(p);
    else if (d <= 90) g.d90.push(p);
    else if (d <= 120) g.d120.push(p);
  }
  return g;
}

/** Outreach is overdue when renewal is within 120 days and the prospect hasn't been contacted in the last 30 days. */
export function isOutreachOverdue(p: Pick<Prospect, "renewal_date" | "last_contacted_at">, todayIso: string): boolean {
  const d = daysUntilRenewal(p.renewal_date, todayIso);
  if (d === null || d < 0 || d > 120) return false;
  if (!p.last_contacted_at) return true;
  return diffDays(p.last_contacted_at.slice(0, 10), todayIso) > 30;
}
