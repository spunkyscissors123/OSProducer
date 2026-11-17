import "server-only";
import { cache } from "react";
import { requireUser } from "../auth";
import { today } from "../domain/dates";
import { NICHES, PAGE_SIZE, SIZE_BANDS, type ProspectFilters } from "../domain/filters";
import { entitlementsFor } from "../plans";
import { DEFAULT_SETTINGS, type Subscription } from "../types";
import type { ProspectRow, Repo } from "./repo";

/** Escape user text for PostgREST ilike/or filters. */
const likeSafe = (s: string) => s.replace(/[\\%_,()*]/g, (c) => `\\${c}`);

function fail(error: { message: string } | null, what: string): void {
  if (error) {
    console.error(`[repo] ${what}:`, error.message);
    throw new Error(`Could not load ${what}`);
  }
}

export const getLiveRepo = cache(async (): Promise<Repo> => {
  const { supabase, user } = await requireUser();
  const todayIso = today();

  const repo: Repo = {
    mode: "live",
    basePath: "",
    todayIso,

    async getProfile() {
      const { data } = await supabase.from("profiles").select("id, full_name, agency_name").eq("id", user.id).maybeSingle();
      return { id: user.id, full_name: data?.full_name ?? null, agency_name: data?.agency_name ?? null, email: user.email ?? null };
    },

    getSettings: cache(async () => {
      const { data } = await supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle();
      if (!data) return DEFAULT_SETTINGS;
      return {
        agency_commission_rate: Number(data.agency_commission_rate),
        new_business_split: Number(data.new_business_split),
        renewal_split: Number(data.renewal_split),
        renewal_offsets: data.renewal_offsets,
        auto_renewal_tasks: data.auto_renewal_tasks,
      };
    }),

    getEntitlements: cache(async () => {
      const { data } = await supabase.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle();
      return entitlementsFor(data as Subscription | null);
    }),

    async getAiUsageThisMonth() {
      const start = `${todayIso.slice(0, 7)}-01T00:00:00Z`;
      const { count } = await supabase.from("ai_generations").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", start);
      return count ?? 0;
    },

    listActiveProspects: cache(async () => {
      const { data, error } = await supabase.from("prospects").select("*").eq("user_id", user.id).is("archived_at", null).order("created_at", { ascending: false }).limit(5000);
      fail(error, "prospects");
      return (data ?? []).map(normalizeProspect);
    }),

    async listProspects(f: ProspectFilters) {
      let q = supabase.from("prospect_list").select("*", { count: "exact" }).eq("user_id", user.id);
      q = f.archived ? q.not("archived_at", "is", null) : q.is("archived_at", null);
      if (f.q) {
        const s = likeSafe(f.q);
        q = q.or(`business_name.ilike.%${s}%,contact_name.ilike.%${s}%,city.ilike.%${s}%`);
      }
      if (f.industry) q = q.eq("industry", f.industry);
      if (f.state) q = q.eq("state", f.state);
      if (f.city) q = q.ilike("city", `%${likeSafe(f.city)}%`);
      if (f.zip) q = q.like("zip", `${likeSafe(f.zip)}%`);
      if (f.renewalMonth) q = q.eq("renewal_month", Number(f.renewalMonth));
      if (f.stage === "none") q = q.is("pipeline_stage", null);
      else if (f.stage) q = q.eq("pipeline_stage", f.stage);
      const band = SIZE_BANDS.find((b) => b.id === f.size);
      if (band) q = q.gte("employee_count", band.min).lte("employee_count", band.max);
      const niche = NICHES.find((n) => n.id === f.niche);
      if (niche) q = q.in("industry", [...niche.industries]);

      switch (f.sort) {
        case "premium_desc": q = q.order("estimated_premium", { ascending: false, nullsFirst: false }); break;
        case "premium_asc": q = q.order("estimated_premium", { ascending: true, nullsFirst: false }); break;
        case "renewal_asc": q = q.order("renewal_date", { ascending: true, nullsFirst: false }); break;
        case "name_asc": q = q.order("business_name", { ascending: true }); break;
        default: q = q.order("created_at", { ascending: false });
      }
      const page = f.page ?? 1;
      q = q.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
      const { data, error, count } = await q;
      fail(error, "prospects");
      return { rows: (data ?? []).map((r) => normalizeProspect(r) as ProspectRow), total: count ?? 0 };
    },

    async getProspect(id: string) {
      const [p, c, o, a, t] = await Promise.all([
        supabase.from("prospects").select("*").eq("id", id).eq("user_id", user.id).maybeSingle(),
        supabase.from("contacts").select("*").eq("prospect_id", id).order("created_at"),
        supabase.from("opportunities").select("*").eq("prospect_id", id).order("created_at", { ascending: false }),
        supabase.from("activities").select("*").eq("prospect_id", id).order("occurred_at", { ascending: false }).limit(100),
        supabase.from("tasks").select("*").eq("prospect_id", id).order("due_date"),
      ]);
      if (!p.data) return null;
      return {
        prospect: normalizeProspect(p.data),
        contacts: c.data ?? [],
        opportunities: (o.data ?? []).map(normalizeOpp),
        activities: a.data ?? [],
        tasks: t.data ?? [],
      };
    },

    listOpportunities: cache(async () => {
      const { data, error } = await supabase
        .from("opportunities")
        .select("*, prospect:prospects!inner(id, business_name, industry, city, state, renewal_date, renewal_date_status, archived_at)")
        .eq("user_id", user.id)
        .is("prospect.archived_at", null)
        .order("stage_changed_at", { ascending: false })
        .limit(5000);
      fail(error, "opportunities");
      return (data ?? []).map(normalizeOpp);
    }),

    listTasks: cache(async () => {
      const { data, error } = await supabase.from("tasks").select("*, prospect:prospects(business_name)").eq("user_id", user.id).order("due_date").limit(5000);
      fail(error, "tasks");
      return data ?? [];
    }),

    async listActivities(limit = 50) {
      const { data, error } = await supabase.from("activities").select("*, prospect:prospects(business_name)").eq("user_id", user.id).order("occurred_at", { ascending: false }).limit(limit);
      fail(error, "activities");
      return data ?? [];
    },

    async listAiHistory(limit = 20) {
      const { data } = await supabase.from("ai_generations").select("id, prospect_id, kind, tone, output, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(limit);
      return data ?? [];
    },

    async listProspectOptions() {
      const { data } = await supabase.from("prospects").select("id, business_name").eq("user_id", user.id).is("archived_at", null).order("business_name").limit(5000);
      return data ?? [];
    },
  };
  return repo;
});

// Postgres numeric comes back as string from PostgREST in some configs — normalize.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeProspect(r: any) {
  return {
    ...r,
    estimated_premium: r.estimated_premium === null ? null : Number(r.estimated_premium),
    annual_revenue: r.annual_revenue === null ? null : Number(r.annual_revenue),
    coverage_lines: r.coverage_lines ?? [],
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeOpp(r: any) {
  return { ...r, estimated_premium: r.estimated_premium === null ? null : Number(r.estimated_premium), coverage_lines: r.coverage_lines ?? [] };
}
