import type { PlanTier, Subscription } from "./types";

export type Feature = "ai" | "advanced_reporting" | "commission_forecasting" | "csv_import";

export interface PlanConfig {
  id: Exclude<PlanTier, "trial">;
  name: string;
  priceCents: number;
  description: string;
  aiGenerationsPerMonth: number;
  csvRowsPerImport: number;
  features: Feature[];
  highlights: string[];
}

// Pricing is configurable via env (display) and Stripe price IDs (billing).
export const PLANS: Record<PlanConfig["id"], PlanConfig> = {
  starter: {
    id: "starter",
    name: "Starter",
    priceCents: Number(process.env.NEXT_PUBLIC_PRICE_STARTER_CENTS ?? 2900),
    description: "Everything a producer needs to organize prospects and never miss a renewal.",
    aiGenerationsPerMonth: 50,
    csvRowsPerImport: 250,
    features: ["ai", "csv_import"],
    highlights: ["Prospect database", "Sales pipeline", "Renewal tracking & auto-tasks", "Task management", "50 AI generations / month", "CSV import up to 250 rows"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceCents: Number(process.env.NEXT_PUBLIC_PRICE_PRO_CENTS ?? 4900),
    description: "For producers building a book at scale with forecasting and deeper analytics.",
    aiGenerationsPerMonth: 500,
    csvRowsPerImport: 5000,
    features: ["ai", "csv_import", "advanced_reporting", "commission_forecasting"],
    highlights: ["Everything in Starter", "500 AI generations / month", "Advanced reporting", "Commission forecasting", "CSV import up to 5,000 rows"],
  },
};

/** Trial = Starter features for 14 days, with a smaller AI allowance to control cost. */
const TRIAL = { aiGenerationsPerMonth: 15, csvRowsPerImport: 250, features: ["ai", "csv_import", "commission_forecasting"] as Feature[] };

export interface Entitlements {
  plan: PlanTier;
  active: boolean;
  label: string;
  aiGenerationsPerMonth: number;
  csvRowsPerImport: number;
  features: Feature[];
  trialDaysLeft: number | null;
}

const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export function entitlementsFor(sub: Subscription | null, now = new Date()): Entitlements {
  if (!sub) return { plan: "trial", active: false, label: "No plan", aiGenerationsPerMonth: 0, csvRowsPerImport: 0, features: [], trialDaysLeft: null };

  if (sub.plan === "trial") {
    const ends = sub.trial_ends_at ? new Date(sub.trial_ends_at) : now;
    const daysLeft = Math.max(0, Math.ceil((ends.getTime() - now.getTime()) / 86_400_000));
    const active = ends > now;
    return {
      plan: "trial",
      active,
      label: active ? `Free trial · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : "Trial ended",
      aiGenerationsPerMonth: active ? TRIAL.aiGenerationsPerMonth : 0,
      csvRowsPerImport: active ? TRIAL.csvRowsPerImport : 0,
      features: active ? TRIAL.features : [],
      trialDaysLeft: daysLeft,
    };
  }

  const cfg = PLANS[sub.plan];
  const active = ACTIVE_STATUSES.has(sub.status);
  return {
    plan: sub.plan,
    active,
    label: active ? cfg.name : `${cfg.name} · ${sub.status.replace("_", " ")}`,
    aiGenerationsPerMonth: active ? cfg.aiGenerationsPerMonth : 0,
    csvRowsPerImport: active ? cfg.csvRowsPerImport : 0,
    features: active ? cfg.features : [],
    trialDaysLeft: null,
  };
}

export const hasFeature = (e: Entitlements, f: Feature) => e.features.includes(f);

export function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}
