import { NextResponse } from "next/server";
import { z } from "zod";
import { audit, AuthError, getUserOrThrow } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { getStripe, isStripeConfigured, priceIdFor } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const { supabase, user } = await getUserOrThrow();
    if (!isStripeConfigured()) return NextResponse.json({ error: "Billing is not configured yet." }, { status: 503 });
    if (!rateLimit(`checkout:${user.id}`, 10, 10 * 60 * 1000).ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

    const { plan } = z.object({ plan: z.enum(["starter", "pro"]) }).parse(await req.json());
    const stripe = getStripe();

    const { data: sub } = await supabase.from("subscriptions").select("stripe_customer_id, stripe_subscription_id, status, plan").eq("user_id", user.id).maybeSingle();
    if (sub?.stripe_subscription_id && ["active", "trialing", "past_due"].includes(sub.status)) {
      return NextResponse.json({ error: "You already have a subscription. Use Manage billing to change plans." }, { status: 409 });
    }

    let customerId = sub?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email ?? undefined, metadata: { user_id: user.id } });
      customerId = customer.id;
      // Subscription rows are service-role only (users cannot write billing state).
      await createAdminClient().from("subscriptions").upsert({ user_id: user.id, stripe_customer_id: customerId }, { onConflict: "user_id" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceIdFor(plan), quantity: 1 }],
      allow_promotion_codes: true,
      subscription_data: { metadata: { user_id: user.id } },
      metadata: { user_id: user.id, plan },
      success_url: `${publicEnv.appUrl}/billing?checkout=success`,
      cancel_url: `${publicEnv.appUrl}/billing?checkout=canceled`,
    });
    await audit(supabase, user.id, "billing.checkout_started", { type: "subscription" }, { plan });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
    console.error("[checkout]", e);
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  }
}
