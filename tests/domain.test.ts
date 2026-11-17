import { describe, expect, it } from "vitest";
import { calculateCommission, producerCommission } from "@/lib/domain/commission";
import { CATCH_UP_OFFSET, groupByRenewalWindow, isOutreachOverdue, planRenewalTasks, renewalWindow } from "@/lib/domain/renewals";
import { parseProspectCsv, prospectsToCsv, safeCell, normalizeDate } from "@/lib/domain/csv";
import { funnelConversion, stageStats, winRate } from "@/lib/domain/pipeline";
import { buildUserPrompt, prospectFacts } from "@/lib/domain/ai-prompts";
import { entitlementsFor } from "@/lib/plans";
import { prospectSchema } from "@/lib/validations";
import { filterProspects, stageByProspect } from "@/lib/domain/filters";
import { computeKpis } from "@/lib/domain/dashboard";
import { buildDemoData } from "@/lib/data/demo-data";
import { DEFAULT_SETTINGS, type Opportunity, type Prospect } from "@/lib/types";

const baseProspect = (over: Partial<Prospect> = {}): Prospect => ({
  id: "p1", business_name: "Fictional Co", industry: "Manufacturing", website: null, address: null, city: "Springfield", state: "IL",
  zip: null, employee_count: 40, annual_revenue: null, contact_name: "Pat Example", contact_title: null, contact_email: null,
  contact_phone: null, current_carrier: null, current_agency: null, renewal_date: null, renewal_date_status: "unknown",
  estimated_premium: null, coverage_lines: [], notes: null, lead_source: null, data_source: "user_entered", last_contacted_at: null,
  next_follow_up_date: null, archived_at: null, created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z", ...over,
});

const opp = (over: Partial<Opportunity>): Opportunity => ({
  id: Math.random().toString(), prospect_id: "p1", name: "x", stage: "new_prospect", estimated_premium: 0, close_probability: 10,
  coverage_lines: [], expected_close_date: null, stage_changed_at: "", won_at: null, lost_at: null, lost_reason: null,
  created_at: "2026-01-01", ...over,
});

describe("commission", () => {
  it("matches the spec example ($100k @15% → $15k agency, 40% → $6k producer)", () => {
    const r = calculateCommission({ annualPremium: 100_000, agencyCommissionRate: 15, newBusinessSplit: 40, renewalSplit: 25, closeProbability: 50 });
    expect(r.agencyCommission).toBe(15_000);
    expect(r.producerNewBusiness).toBe(6_000);
    expect(r.producerRenewal).toBe(3_750);
    expect(r.weightedPremium).toBe(50_000);
    expect(r.weightedProducerNewBusiness).toBe(3_000);
    expect(r.projectedAnnualProduction).toBe(4_875);
  });
  it("clamps bad inputs", () => {
    const r = calculateCommission({ annualPremium: -5, agencyCommissionRate: 500, newBusinessSplit: NaN, renewalSplit: 0, closeProbability: 100 });
    expect(r.agencyCommission).toBe(0);
    expect(producerCommission(null, 15, 40)).toBe(0);
  });
});

describe("renewal engine", () => {
  const today = "2026-06-01";
  it("creates 120/90/60/30 tasks for an Oct 1 renewal", () => {
    const t = planRenewalTasks({ businessName: "A", renewalDate: "2026-10-01", renewalStatus: "known", offsets: [30, 60, 90, 120], todayIso: today });
    expect(t.map((x) => [x.offset_days, x.due_date])).toEqual([
      [120, "2026-06-03"], [90, "2026-07-03"], [60, "2026-08-02"], [30, "2026-09-01"],
    ]);
  });
  it("never creates tasks for unknown renewal dates", () => {
    expect(planRenewalTasks({ businessName: "A", renewalDate: null, renewalStatus: "unknown", offsets: [120], todayIso: today })).toEqual([]);
  });
  it("adds a single catch-up task when windows have passed", () => {
    const t = planRenewalTasks({ businessName: "A", renewalDate: "2026-07-15", renewalStatus: "estimated", offsets: [120, 90, 60, 30], todayIso: today });
    expect(t.map((x) => x.offset_days)).toEqual([CATCH_UP_OFFSET, 30]);
    expect(t[0].description).toContain("ESTIMATE");
  });
  it("is deterministic (same keys on recalculation) and de-dupes offsets", () => {
    const a = planRenewalTasks({ businessName: "A", renewalDate: "2026-10-01", renewalStatus: "known", offsets: [90, 90, 120], todayIso: today });
    const b = planRenewalTasks({ businessName: "A", renewalDate: "2026-10-01", renewalStatus: "known", offsets: [120, 90], todayIso: today });
    expect(a).toEqual(b);
    expect(a).toHaveLength(2);
  });
  it("buckets windows and flags overdue outreach", () => {
    expect(renewalWindow("2026-06-20", today)).toBe(30);
    expect(renewalWindow("2026-09-10", today)).toBe(120);
    expect(renewalWindow("2026-12-01", today)).toBeNull();
    const g = groupByRenewalWindow([baseProspect({ renewal_date: "2026-05-01" }), baseProspect()], today);
    expect(g.passed).toHaveLength(1);
    expect(g.unknown).toHaveLength(1);
    expect(isOutreachOverdue({ renewal_date: "2026-07-01", last_contacted_at: null }, today)).toBe(true);
    expect(isOutreachOverdue({ renewal_date: "2026-07-01", last_contacted_at: "2026-05-20T10:00:00Z" }, today)).toBe(false);
  });
});

describe("csv", () => {
  it("maps headers, normalizes values, and reports invalid rows", () => {
    const csv = "Company,State,Renewal Date,Premium,Coverage,Email\nAcme Fictional,il,10/01/2027,\"$42,000\",GL; WC; Cyber,a@example.com\n,TX,,,,\nBad Date Co,TX,13/45/2027,,,\n";
    const r = parseProspectCsv(csv, 100);
    expect(r.validCount).toBe(1);
    expect(r.invalidCount).toBe(2);
    const row = r.rows[0].data!;
    expect(row.state).toBe("IL");
    expect(row.renewal_date).toBe("2027-10-01");
    expect(row.renewal_date_status).toBe("known");
    expect(row.estimated_premium).toBe(42000);
    expect(row.coverage_lines).toEqual(["general_liability", "workers_comp", "cyber"]);
  });
  it("enforces the row limit", () => {
    const csv = "Company\n" + Array.from({ length: 10 }, (_, i) => `Co ${i}`).join("\n");
    expect(parseProspectCsv(csv, 3).rows).toHaveLength(3);
  });
  it("neutralizes formula injection on export", () => {
    expect(safeCell("=HYPERLINK(\"x\")")).toBe("'=HYPERLINK(\"x\")");
    expect(safeCell(["a", "b"])).toBe("a; b");
    expect(prospectsToCsv([{ business_name: "+cmd" }])).toContain("'+cmd");
    expect(normalizeDate("1/5/27")).toBe("2027-01-05");
  });
});

describe("validation", () => {
  it("keeps unknown renewal dates unknown and upgrades typed dates to known", () => {
    expect(prospectSchema.parse({ business_name: "X", renewal_date: "", renewal_date_status: "estimated" }).renewal_date_status).toBe("unknown");
    expect(prospectSchema.parse({ business_name: "X", renewal_date: "2027-01-01" }).renewal_date_status).toBe("known");
    expect(prospectSchema.parse({ business_name: "X", renewal_date: "2027-01-01", renewal_date_status: "estimated" }).renewal_date_status).toBe("estimated");
    expect(prospectSchema.parse({ business_name: "X", website: "example.com" }).website).toBe("https://example.com");
    expect(prospectSchema.safeParse({ business_name: "" }).success).toBe(false);
  });
});

describe("pipeline analytics", () => {
  const opps = [opp({ stage: "won", estimated_premium: 10000 }), opp({ stage: "lost" }), opp({ stage: "quoting", estimated_premium: 20000, close_probability: 50 })];
  it("computes stage stats, funnel, and win rate", () => {
    const s = stageStats(opps, 15, 40);
    expect(s.find((x) => x.stage === "quoting")).toMatchObject({ count: 1, premium: 20000, weightedPremium: 10000, commission: 1200 });
    expect(funnelConversion(opps)[0].rate).toBe(1);
    expect(funnelConversion(opps).find((f) => f.stage === "quoting")!.reached).toBe(2);
    expect(winRate(opps)).toBe(0.5);
  });
});

describe("AI prompt safety", () => {
  it("labels unknowns and estimates instead of inventing them", () => {
    const facts = prospectFacts(baseProspect());
    expect(facts).toContain("Renewal date: UNKNOWN");
    expect(facts).toContain("Current carrier: UNKNOWN");
    const est = prospectFacts(baseProspect({ renewal_date: "2027-03-01", renewal_date_status: "estimated" }));
    expect(est).toContain("ESTIMATE");
    const prompt = buildUserPrompt({ req: { kind: "intro_email", tone: "direct" }, prospect: baseProspect() });
    expect(prompt).toContain("PROSPECT FACTS");
    expect(prompt).toContain("lead with the ask");
  });
});

describe("plans", () => {
  const now = new Date("2026-11-17T00:00:00Z");
  it("grants trial and blocks after expiry", () => {
    const sub = { plan: "trial" as const, status: "trialing", trial_ends_at: "2026-11-20T00:00:00Z", stripe_customer_id: null, current_period_end: null, cancel_at_period_end: false };
    expect(entitlementsFor(sub, now)).toMatchObject({ active: true, trialDaysLeft: 3 });
    expect(entitlementsFor({ ...sub, trial_ends_at: "2026-11-01T00:00:00Z" }, now).aiGenerationsPerMonth).toBe(0);
  });
  it("gates pro features", () => {
    const starter = entitlementsFor({ plan: "starter", status: "active", trial_ends_at: null, stripe_customer_id: "c", current_period_end: null, cancel_at_period_end: false });
    expect(starter.features).not.toContain("commission_forecasting");
    const canceled = entitlementsFor({ plan: "pro", status: "canceled", trial_ends_at: null, stripe_customer_id: "c", current_period_end: null, cancel_at_period_end: false });
    expect(canceled.active).toBe(false);
  });
});

describe("demo data + filters + KPIs", () => {
  const demo = buildDemoData("2026-11-17");
  it("is fictional and internally consistent", () => {
    expect(demo.prospects.length).toBeGreaterThanOrEqual(20);
    for (const p of demo.prospects) {
      if (p.contact_email) expect(p.contact_email).toMatch(/[@.]example\.com$/);
      if (p.renewal_date_status === "unknown") expect(p.renewal_date).toBeNull();
    }
    for (const o of demo.opportunities) expect(demo.prospects.some((p) => p.id === o.prospect_id)).toBe(true);
  });
  it("filters and computes KPIs", () => {
    const stages = stageByProspect(demo.opportunities);
    const mfg = filterProspects(demo.prospects, { industry: "Manufacturing", sort: "premium_desc" }, stages);
    expect(mfg.every((p) => p.industry === "Manufacturing")).toBe(true);
    expect((mfg[0].estimated_premium ?? 0) >= (mfg[mfg.length - 1].estimated_premium ?? 0)).toBe(true);
    const k = computeKpis(demo.prospects, demo.opportunities, DEFAULT_SETTINGS, "2026-11-17");
    expect(k.activeProspects).toBe(demo.prospects.filter((p) => !p.archived_at).length);
    expect(k.premiumPipeline).toBeGreaterThan(0);
  });
});

describe("formatting", () => {
  it("formats compact currency deterministically (no Intl compact → no hydration mismatch)", async () => {
    const { formatCurrency } = await import("@/lib/utils");
    expect(formatCurrency(45000, { compact: true })).toBe("$45K");
    expect(formatCurrency(1_250_000, { compact: true })).toBe("$1.3M");
    expect(formatCurrency(9500, { compact: true })).toBe("$9,500");
    expect(formatCurrency(null)).toBe("—");
  });
});

describe("demo ids", () => {
  it("are valid UUIDs (accepted by the same validation as live data)", () => {
    const d = buildDemoData("2026-11-17");
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    for (const x of [...d.prospects, ...d.opportunities, ...d.tasks, ...d.activities]) expect(x.id).toMatch(uuid);
  });
});
