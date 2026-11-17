import "server-only";
import Stripe from "stripe";
import { requireServerEnv } from "./env";
import type { PlanConfig } from "./plans";

let client: Stripe | null = null;

/**
 * Returns the Stripe client. Refuses LIVE keys unless ALLOW_LIVE_BILLING === "true" so live billing
 * can never be activated by accident — this requires an explicit, deliberate configuration change.
 */
export function getStripe(): Stripe {
  if (client) return client;
  const key = requireServerEnv("STRIPE_SECRET_KEY");
  if (key.startsWith("sk_live_") && process.env.ALLOW_LIVE_BILLING !== "true") {
    throw new Error("Live Stripe key detected but ALLOW_LIVE_BILLING is not 'true'. Refusing to start live billing.");
  }
  client = new Stripe(key, { appInfo: { name: "ProducerOS" } });
  return client;
}

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_STARTER && process.env.STRIPE_PRICE_PRO);
}

export function priceIdFor(plan: PlanConfig["id"]): string {
  return requireServerEnv(plan === "pro" ? "STRIPE_PRICE_PRO" : "STRIPE_PRICE_STARTER");
}

export function planForPrice(priceId: string | null | undefined): PlanConfig["id"] | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  if (priceId === process.env.STRIPE_PRICE_STARTER) return "starter";
  return null;
}
