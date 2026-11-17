import type { Activity, Opportunity, Prospect, Task, UserSettings } from "../types";
import { OPEN_STAGES } from "../types";
import { producerCommission, round2 } from "./commission";
import { addDays, monthKey } from "./dates";
import { groupByRenewalWindow, isOutreachOverdue } from "./renewals";

export interface DashboardKpis {
  activeProspects: number;
  newThisMonth: number;
  contacted: number;
  contactedThisMonth: number;
  meetingsScheduled: number;
  quoting: number;
  premiumPipeline: number;
  commissionPipeline: number;
  closedPremiumYtd: number;
  closedCountYtd: number;
}

export function computeKpis(prospects: Prospect[], opps: Opportunity[], settings: UserSettings, todayIso: string): DashboardKpis {
  const active = prospects.filter((p) => !p.archived_at);
  const thisMonth = monthKey(todayIso);
  const year = todayIso.slice(0, 4);
  const open = opps.filter((o) => (OPEN_STAGES as string[]).includes(o.stage));
  const premiumPipeline = open.reduce((s, o) => s + (o.estimated_premium ?? 0), 0);
  const wonYtd = opps.filter((o) => o.stage === "won" && o.won_at?.startsWith(year));
  return {
    activeProspects: active.length,
    newThisMonth: active.filter((p) => p.created_at.startsWith(thisMonth)).length,
    contacted: active.filter((p) => p.last_contacted_at).length,
    contactedThisMonth: active.filter((p) => p.last_contacted_at?.startsWith(thisMonth)).length,
    meetingsScheduled: opps.filter((o) => o.stage === "meeting_scheduled").length,
    quoting: opps.filter((o) => o.stage === "quoting").length,
    premiumPipeline: round2(premiumPipeline),
    commissionPipeline: producerCommission(premiumPipeline, settings.agency_commission_rate, settings.new_business_split),
    closedPremiumYtd: round2(wonYtd.reduce((s, o) => s + (o.estimated_premium ?? 0), 0)),
    closedCountYtd: wonYtd.length,
  };
}

/** Won premium + producer commission by month for the trailing 12 months (oldest first). */
export function monthlyProduction(opps: Opportunity[], settings: UserSettings, todayIso: string) {
  const [y, m] = todayIso.split("-").map(Number);
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  return months.map((key) => {
    const won = opps.filter((o) => o.stage === "won" && o.won_at?.startsWith(key));
    const premium = won.reduce((s, o) => s + (o.estimated_premium ?? 0), 0);
    return {
      month: key,
      premium: round2(premium),
      commission: producerCommission(premium, settings.agency_commission_rate, settings.new_business_split),
      deals: won.length,
    };
  });
}

export interface DailyAttention {
  dueToday: Task[];
  overdue: Task[];
  upcoming: Task[];
  followUpsDue: Prospect[];
  renewalOutreachOverdue: Prospect[];
}

/** The daily prospecting list: which tasks and businesses need attention. */
export function dailyAttention(tasks: Task[], prospects: Prospect[], todayIso: string): DailyAttention {
  const open = tasks.filter((t) => t.status === "open");
  const weekOut = addDays(todayIso, 7);
  const active = prospects.filter((p) => !p.archived_at);
  return {
    dueToday: open.filter((t) => t.due_date === todayIso),
    overdue: open.filter((t) => t.due_date < todayIso).sort((a, b) => a.due_date.localeCompare(b.due_date)),
    upcoming: open.filter((t) => t.due_date > todayIso && t.due_date <= weekOut).sort((a, b) => a.due_date.localeCompare(b.due_date)),
    followUpsDue: active.filter((p) => p.next_follow_up_date && p.next_follow_up_date <= todayIso),
    renewalOutreachOverdue: active.filter((p) => isOutreachOverdue(p, todayIso)),
  };
}

export function upcomingRenewals(prospects: Prospect[], todayIso: string, limit = 8) {
  const g = groupByRenewalWindow(prospects.filter((p) => !p.archived_at), todayIso);
  return [...g.d30, ...g.d60, ...g.d90, ...g.d120]
    .sort((a, b) => (a.renewal_date ?? "").localeCompare(b.renewal_date ?? ""))
    .slice(0, limit);
}

export function recentActivity(activities: Activity[], limit = 8) {
  return [...activities].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)).slice(0, limit);
}
