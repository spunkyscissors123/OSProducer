import { NextResponse } from "next/server";
import { AuthError, getUserOrThrow } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

export async function POST() {
  try {
    const { supabase, user } = await getUserOrThrow();
    if (!isStripeConfigured()) return NextResponse.json({ error: "Billing is not configured yet." }, { status: 503 });
    const { data: sub } = await supabase.from("subscriptions").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
    if (!sub?.stripe_customer_id) return NextResponse.json({ error: "No billing account yet — choose a plan first." }, { status: 400 });
    const session = await getStripe().billingPortal.sessions.create({ customer: sub.stripe_customer_id, return_url: `${publicEnv.appUrl}/billing` });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    console.error("[portal]", e);
    return NextResponse.json({ error: "Could not open billing portal." }, { status: 500 });
  }
}
