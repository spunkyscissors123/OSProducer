import { cache } from "react";
import { today } from "../domain/dates";
import { filterProspects, PAGE_SIZE, stageByProspect } from "../domain/filters";
import type { Entitlements } from "../plans";
import { buildDemoData } from "./demo-data";
import type { ProspectRow, Repo } from "./repo";

const DEMO_ENTITLEMENTS: Entitlements = {
  plan: "pro",
  active: true,
  label: "Demo · Pro features",
  aiGenerationsPerMonth: 999,
  csvRowsPerImport: 0,
  features: ["ai", "advanced_reporting", "commission_forecasting"],
  trialDaysLeft: null,
};

/** In-memory, read-only fictional data. Never touches the database. */
export const getDemoRepo = cache(async (): Promise<Repo> => {
  const todayIso = today();
  const d = buildDemoData(todayIso);
  const stages = stageByProspect(d.opportunities);
  const latestOpp = new Map(d.opportunities.map((o) => [o.prospect_id, o.id]));
  const withName = <T extends { prospect_id: string | null }>(x: T) => ({
    ...x,
    prospect: x.prospect_id ? { business_name: d.prospects.find((p) => p.id === x.prospect_id)?.business_name ?? "" } : null,
  });

  return {
    mode: "demo",
    basePath: "/demo",
    todayIso,
    getProfile: async () => ({ id: "demo", full_name: "Jordan Demo", agency_name: "Demo Insurance Agency (fictional)", email: "demo@example.com" }),
    getSettings: async () => d.settings,
    getEntitlements: async () => DEMO_ENTITLEMENTS,
    getAiUsageThisMonth: async () => 0,
    listActiveProspects: async () => d.prospects.filter((p) => !p.archived_at),
    listProspects: async (f) => {
      const all = filterProspects(d.prospects, f, stages);
      const page = f.page ?? 1;
      const rows: ProspectRow[] = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((p) => ({
        ...p,
        pipeline_stage: stages.get(p.id) ?? null,
        opportunity_id: latestOpp.get(p.id) ?? null,
      }));
      return { rows, total: all.length };
    },
    getProspect: async (id) => {
      const prospect = d.prospects.find((p) => p.id === id);
      if (!prospect) return null;
      return {
        prospect,
        contacts: [],
        opportunities: d.opportunities.filter((o) => o.prospect_id === id),
        activities: d.activities.filter((a) => a.prospect_id === id).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)),
        tasks: d.tasks.filter((t) => t.prospect_id === id).sort((a, b) => a.due_date.localeCompare(b.due_date)),
      };
    },
    listOpportunities: async () =>
      d.opportunities.map((o) => {
        const p = d.prospects.find((x) => x.id === o.prospect_id)!;
        return { ...o, prospect: { id: p.id, business_name: p.business_name, industry: p.industry, city: p.city, state: p.state, renewal_date: p.renewal_date, renewal_date_status: p.renewal_date_status } };
      }),
    listTasks: async () => d.tasks.map(withName),
    listActivities: async (limit = 50) => [...d.activities].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)).slice(0, limit),
    listAiHistory: async () => [],
    listProspectOptions: async () => d.prospects.map((p) => ({ id: p.id, business_name: p.business_name })).sort((a, b) => a.business_name.localeCompare(b.business_name)),
  };
});
