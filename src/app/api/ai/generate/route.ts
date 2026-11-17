import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { audit, AuthError, getUserOrThrow } from "@/lib/auth";
import { buildUserPrompt, SYSTEM_PROMPT, AI_KIND_META, demoOutput } from "@/lib/domain/ai-prompts";
import { entitlementsFor, hasFeature } from "@/lib/plans";
import { stageLabel, type Activity, type Prospect, type Subscription } from "@/lib/types";
import { aiRequestSchema } from "@/lib/validations";
import { getDemoRepo } from "@/lib/data/demo-repo";

export const runtime = "nodejs";
const PER_MINUTE_LIMIT = 5;
const MAX_OUTPUT_TOKENS = 900;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Demo mode: deterministic template output, no API call, no auth, no cost.
  if ((body as { demo?: boolean })?.demo === true) {
    const parsed = aiRequestSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const repo = await getDemoRepo();
    const detail = parsed.data.prospect_id ? await repo.getProspect(parsed.data.prospect_id) : null;
    return NextResponse.json({ output: demoOutput(parsed.data, detail?.prospect), demo: true });
  }

  try {
    const { supabase, user } = await getUserOrThrow();
    const input = aiRequestSchema.parse(body);

    if (process.env.AI_ENABLED === "false") return NextResponse.json({ error: "AI features are temporarily disabled." }, { status: 503 });
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "AI is not configured (missing OPENAI_API_KEY)." }, { status: 503 });

    // ── Usage controls (durable, DB-backed) ─────────────────────────
    const { data: sub } = await supabase.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle();
    const ent = entitlementsFor(sub as Subscription | null);
    if (!hasFeature(ent, "ai")) return NextResponse.json({ error: "AI generations require an active plan.", upgrade: true }, { status: 402 });

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const minuteAgo = new Date(Date.now() - 60_000).toISOString();
    const [{ count: monthCount }, { count: minuteCount }] = await Promise.all([
      supabase.from("ai_generations").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", monthStart.toISOString()),
      supabase.from("ai_generations").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", minuteAgo),
    ]);
    if ((minuteCount ?? 0) >= PER_MINUTE_LIMIT) return NextResponse.json({ error: "You're generating quickly — please wait a minute." }, { status: 429 });
    if ((monthCount ?? 0) >= ent.aiGenerationsPerMonth) {
      return NextResponse.json({ error: `Monthly AI limit reached (${ent.aiGenerationsPerMonth}). Upgrade for more.`, upgrade: true }, { status: 402 });
    }

    // ── Context: only the user's own data (RLS enforced) ────────────
    let prospect: Prospect | null = null;
    let activities: Activity[] = [];
    let stage: string | null = null;
    if (AI_KIND_META[input.kind].needsProspect) {
      if (!input.prospect_id) return NextResponse.json({ error: "Select a prospect for this type of message." }, { status: 400 });
      const [{ data: p }, { data: acts }, { data: opp }] = await Promise.all([
        supabase.from("prospects").select("*").eq("id", input.prospect_id).eq("user_id", user.id).maybeSingle(),
        supabase.from("activities").select("*").eq("prospect_id", input.prospect_id).order("occurred_at", { ascending: false }).limit(8),
        supabase.from("opportunities").select("stage").eq("prospect_id", input.prospect_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (!p) return NextResponse.json({ error: "Prospect not found." }, { status: 404 });
      prospect = { ...p, estimated_premium: p.estimated_premium === null ? null : Number(p.estimated_premium), annual_revenue: p.annual_revenue === null ? null : Number(p.annual_revenue) };
      activities = acts ?? [];
      stage = opp?.stage ? stageLabel(opp.stage) : null;
    } else if (!input.industry) {
      return NextResponse.json({ error: "Choose an industry." }, { status: 400 });
    }
    const { data: profile } = await supabase.from("profiles").select("full_name, agency_name").eq("id", user.id).maybeSingle();

    const model = process.env.OPENAI_MODEL || "gpt-5-mini";
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 45_000, maxRetries: 1 });
    const response = await openai.responses.create({
      model,
      instructions: SYSTEM_PROMPT,
      input: buildUserPrompt({ req: input, prospect, stageLabel: stage, activities, producerName: profile?.full_name, agencyName: profile?.agency_name }),
      max_output_tokens: MAX_OUTPUT_TOKENS,
      user: user.id, // abuse monitoring; an opaque id, no PII
    });
    const output = (response.output_text ?? "").trim();
    if (!output) return NextResponse.json({ error: "The AI returned an empty response. Please try again." }, { status: 502 });

    const { data: saved } = await supabase
      .from("ai_generations")
      .insert({
        user_id: user.id,
        prospect_id: prospect?.id ?? null,
        kind: input.kind,
        tone: input.tone,
        output: output.slice(0, 20000),
        model,
        input_tokens: response.usage?.input_tokens ?? null,
        output_tokens: response.usage?.output_tokens ?? null,
      })
      .select("id")
      .single();
    await audit(supabase, user.id, "ai.generate", { type: "ai_generation", id: saved?.id }, { kind: input.kind });

    return NextResponse.json({ output, remaining: Math.max(0, ent.aiGenerationsPerMonth - (monthCount ?? 0) - 1) });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    console.error("[ai]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "AI request failed. Please try again shortly." }, { status: 502 });
  }
}
