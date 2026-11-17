import type { Opportunity, PipelineStage, Prospect } from "../types";

export interface ProspectFilters {
  q?: string;
  industry?: string;
  state?: string;
  city?: string;
  zip?: string;
  renewalMonth?: string; // "01".."12"
  stage?: PipelineStage | "none";
  size?: SizeBand;
  niche?: string;
  archived?: boolean;
  sort?: "premium_desc" | "premium_asc" | "renewal_asc" | "name_asc" | "created_desc";
  page?: number;
}

export const PAGE_SIZE = 25;

export const SIZE_BANDS = [
  { id: "1-9", label: "1–9 employees", min: 1, max: 9 },
  { id: "10-49", label: "10–49 employees", min: 10, max: 49 },
  { id: "50-249", label: "50–249 employees", min: 50, max: 249 },
  { id: "250+", label: "250+ employees", min: 250, max: Number.MAX_SAFE_INTEGER },
] as const;
export type SizeBand = (typeof SIZE_BANDS)[number]["id"];

/** Target insurance niches → industries + key lines. Used by Prospect Finder. */
export const NICHES = [
  { id: "contractors", label: "Contractors & Construction", industries: ["Construction"], lines: ["general_liability", "workers_comp", "commercial_auto", "umbrella"] },
  { id: "manufacturing", label: "Manufacturing & Products", industries: ["Manufacturing", "Wholesale & Distribution"], lines: ["general_liability", "commercial_property", "workers_comp"] },
  { id: "fleet", label: "Fleet & Transportation", industries: ["Transportation"], lines: ["commercial_auto", "umbrella", "workers_comp"] },
  { id: "hospitality", label: "Hospitality & Restaurants", industries: ["Hospitality"], lines: ["general_liability", "commercial_property", "workers_comp"] },
  { id: "habitational", label: "Real Estate & Habitational", industries: ["Real Estate"], lines: ["commercial_property", "general_liability", "umbrella"] },
  { id: "professional", label: "Professional Services & Tech", industries: ["Professional Services", "Technology"], lines: ["professional_liability", "cyber", "general_liability"] },
] as const;

export function parseFilters(sp: Record<string, string | string[] | undefined>): ProspectFilters {
  const g = (k: string) => {
    const v = sp[k];
    const s = Array.isArray(v) ? v[0] : v;
    return s && s.trim() ? s.trim().slice(0, 100) : undefined;
  };
  const page = Number(g("page") ?? 1);
  return {
    q: g("q"),
    industry: g("industry"),
    state: g("state")?.toUpperCase().slice(0, 2),
    city: g("city"),
    zip: g("zip")?.replace(/[^0-9-]/g, ""),
    renewalMonth: g("renewalMonth")?.match(/^(0[1-9]|1[0-2])$/)?.[0],
    stage: g("stage") as ProspectFilters["stage"],
    size: g("size") as SizeBand | undefined,
    niche: g("niche"),
    archived: g("archived") === "1",
    sort: (g("sort") as ProspectFilters["sort"]) ?? "created_desc",
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
  };
}

/** Primary (most recently created, preferring open) opportunity stage per prospect. */
export function stageByProspect(opps: Opportunity[]): Map<string, PipelineStage> {
  const map = new Map<string, Opportunity>();
  for (const o of opps) {
    const cur = map.get(o.prospect_id);
    if (!cur || o.created_at > cur.created_at) map.set(o.prospect_id, o);
  }
  return new Map([...map].map(([k, v]) => [k, v.stage]));
}

/** In-memory filter (used by demo mode and as the reference implementation for tests). */
export function filterProspects(prospects: Prospect[], f: ProspectFilters, stages: Map<string, PipelineStage>): Prospect[] {
  const q = f.q?.toLowerCase();
  const band = SIZE_BANDS.find((b) => b.id === f.size);
  const niche = NICHES.find((n) => n.id === f.niche);
  let out = prospects.filter((p) => {
    if (!!p.archived_at !== !!f.archived) return false;
    if (q && ![p.business_name, p.contact_name, p.city, p.industry].some((v) => v?.toLowerCase().includes(q))) return false;
    if (f.industry && p.industry !== f.industry) return false;
    if (f.state && p.state !== f.state) return false;
    if (f.city && !p.city?.toLowerCase().includes(f.city.toLowerCase())) return false;
    if (f.zip && !p.zip?.startsWith(f.zip)) return false;
    if (f.renewalMonth && p.renewal_date?.slice(5, 7) !== f.renewalMonth) return false;
    if (f.stage === "none" && stages.has(p.id)) return false;
    if (f.stage && f.stage !== "none" && stages.get(p.id) !== f.stage) return false;
    if (band && (p.employee_count === null || p.employee_count < band.min || p.employee_count > band.max)) return false;
    if (niche && !(niche.industries as readonly string[]).includes(p.industry ?? "")) return false;
    return true;
  });
  const premium = (p: Prospect) => p.estimated_premium ?? -1;
  switch (f.sort) {
    case "premium_desc": out = out.sort((a, b) => premium(b) - premium(a)); break;
    case "premium_asc": out = out.sort((a, b) => premium(a) - premium(b)); break;
    case "renewal_asc": out = out.sort((a, b) => (a.renewal_date ?? "9999").localeCompare(b.renewal_date ?? "9999")); break;
    case "name_asc": out = out.sort((a, b) => a.business_name.localeCompare(b.business_name)); break;
    default: out = out.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  return out;
}
