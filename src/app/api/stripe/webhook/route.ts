import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { requireServerEnv } from "@/lib/env";
import { getStripe, planForPrice } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Stripe → ProducerOS subscription sync. Signature-verified and idempotent (stripe_events). */
export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    const raw = await req.text();
    event = getStripe().webhooks.constructEvent(raw, signature, requireServerEnv("STRIPE_WEBHOOK_SECRET"));
  } catch (e) {
    console.error("[webhook] signature verification failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();
  // Idempotency: insert the event id first; a duplicate delivery hits the PK and is skipped.
  const { error: dupErr } = await admin.from("stripe_events").insert({ id: event.id, type: event.type });
  if (dupErr) {
    if (dupErr.code === "23505") return NextResponse.json({ received: true, duplicate: true });
    console.error("[webhook] event log failed", dupErr.message);
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.mode === "subscription" && s.subscription) {
          const sub = await getStripe().subscriptions.retrieve(typeof s.subscription === "string" ? s.subscription : s.subscription.id);
          await syncSubscription(admin, sub, s.client_reference_id ?? s.metadata?.user_id ?? null);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(admin, event.data.object as Stripe.Subscription, null);
        break;
      default:
        break;
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("[webhook] handler failed", e);
    // Remove idempotency marker so Stripe's retry can reprocess.
    await admin.from("stripe_events").delete().eq("id", event.id);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
}

async function syncSubscription(admin: ReturnType<typeof createAdminClient>, sub: Stripe.Subscription, userIdHint: string | null) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  let userId = userIdHint ?? sub.metadata?.user_id ?? null;
  if (!userId) {
    const { data } = await admin.from("subscriptions").select("user_id").eq("stripe_customer_id", customerId).maybeSingle();
    userId = data?.user_id ?? null;
  }
  if (!userId) throw new Error(`No user found for Stripe customer ${customerId}`);

  const item = sub.items.data[0];
  const plan = planForPrice(item?.price?.id);
  const periodEnd = item?.current_period_end ?? null;
  const deleted = sub.status === "canceled" || sub.status === "incomplete_expired";

  const { error } = await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: deleted ? null : sub.id,
      // Keep the paid plan tier on record but status drives access (see entitlementsFor).
      ...(plan ? { plan } : {}),
      status: sub.status,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: sub.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
  await admin.from("audit_logs").insert({ user_id: userId, action: "billing.subscription_sync", entity_type: "subscription", metadata: { status: sub.status, plan } });
}
