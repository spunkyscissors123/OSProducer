"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "../auth";
import { STAGE_DEFAULT_PROBABILITY } from "../domain/pipeline";
import { STAGE_IDS, type ActionResult } from "../types";
import { activitySchema, opportunitySchema, taskSchema } from "../validations";
import { dbError, formDataToObject, withUser } from "./helpers";

const rv = (...paths: string[]) => paths.forEach((p) => revalidatePath(p));

// ── Activities ───────────────────────────────────────────────────────
export async function logActivity(fd: FormData): Promise<ActionResult> {
  return withUser(async (ctx) => {
    const input = activitySchema.parse(formDataToObject(fd));
    const { error } = await ctx.supabase.from("activities").insert({
      user_id: ctx.user.id,
      prospect_id: input.prospect_id,
      type: input.type,
      subject: input.subject,
      body: input.body,
      occurred_at: input.occurred_at ? new Date(input.occurred_at).toISOString() : new Date().toISOString(),
    });
    const err = dbError(error);
    if (err) return err;
    if (input.next_follow_up_date) {
      await ctx.supabase.from("prospects").update({ next_follow_up_date: input.next_follow_up_date }).eq("id", input.prospect_id).eq("user_id", ctx.user.id);
    }
    rv(`/prospects/${input.prospect_id}`, "/dashboard", "/prospects", "/renewals");
    return { ok: true };
  });
}

// ── Opportunities / pipeline ────────────────────────────────────────
export async function moveOpportunityStage(opportunityId: string, stage: string, lostReason?: string): Promise<ActionResult> {
  return withUser(async (ctx) => {
    const id = z.uuid().parse(opportunityId);
    const s = z.enum(STAGE_IDS).parse(stage);
    const { data, error } = await ctx.supabase.rpc("move_opportunity_stage", {
      p_opportunity_id: id,
      p_stage: s,
      p_lost_reason: lostReason?.slice(0, 500) ?? null,
    });
    const err = dbError(error, "Could not move opportunity.");
    if (err) return err;
    await audit(ctx.supabase, ctx.user.id, "opportunity.stage", { type: "opportunity", id }, { stage: s });
    const prospectId = (data as { prospect_id?: string } | null)?.prospect_id;
    rv("/pipeline", "/dashboard", "/analytics", "/prospects", ...(prospectId ? [`/prospects/${prospectId}`] : []));
    return { ok: true };
  });
}

export async function createOpportunity(fd: FormData): Promise<ActionResult> {
  return withUser(async (ctx) => {
    const raw = formDataToObject(fd);
    const input = opportunitySchema.parse({ ...raw, close_probability: raw.close_probability ?? STAGE_DEFAULT_PROBABILITY.new_prospect });
    const { error } = await ctx.supabase.from("opportunities").insert({ ...input, user_id: ctx.user.id });
    const err = dbError(error);
    if (err) return err;
    await audit(ctx.supabase, ctx.user.id, "opportunity.create", { type: "prospect", id: input.prospect_id });
    rv("/pipeline", "/dashboard", "/finder", "/prospects", `/prospects/${input.prospect_id}`);
    return { ok: true };
  });
}

/** Quick "add to pipeline" from Prospect Finder / list — uses the prospect's own premium & lines. */
export async function addProspectToPipeline(prospectId: string): Promise<ActionResult> {
  return withUser(async (ctx) => {
    const id = z.uuid().parse(prospectId);
    const { data: p } = await ctx.supabase.from("prospects").select("id, business_name, estimated_premium, coverage_lines, renewal_date").eq("id", id).eq("user_id", ctx.user.id).maybeSingle();
    if (!p) return { ok: false, error: "Prospect not found." };
    const { count } = await ctx.supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("prospect_id", id);
    if ((count ?? 0) > 0) return { ok: false, error: "Already in your pipeline." };
    const { error } = await ctx.supabase.from("opportunities").insert({
      user_id: ctx.user.id, prospect_id: id, name: `${p.business_name} — commercial package`, stage: "new_prospect",
      estimated_premium: p.estimated_premium, coverage_lines: p.coverage_lines, close_probability: STAGE_DEFAULT_PROBABILITY.new_prospect,
      expected_close_date: p.renewal_date,
    });
    const err = dbError(error);
    if (err) return err;
    rv("/pipeline", "/finder", "/prospects", "/dashboard", `/prospects/${id}`);
    return { ok: true };
  });
}

const oppUpdateSchema = z.object({
  estimated_premium: z.coerce.number().min(0).max(1e10).nullable(),
  close_probability: z.coerce.number().int().min(0).max(100),
  expected_close_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});
export async function updateOpportunity(id: string, values: unknown): Promise<ActionResult> {
  return withUser(async (ctx) => {
    z.uuid().parse(id);
    const input = oppUpdateSchema.parse(values);
    const { data, error } = await ctx.supabase.from("opportunities").update(input).eq("id", id).eq("user_id", ctx.user.id).select("prospect_id").maybeSingle();
    const err = dbError(error);
    if (err) return err;
    rv("/pipeline", "/dashboard", "/analytics", ...(data ? [`/prospects/${data.prospect_id}`] : []));
    return { ok: true };
  });
}

// ── Tasks ────────────────────────────────────────────────────────────
const taskPaths = (prospectId?: string | null) => ["/tasks", "/dashboard", "/renewals", ...(prospectId ? [`/prospects/${prospectId}`] : [])];

export async function createTask(fd: FormData): Promise<ActionResult> {
  return withUser(async (ctx) => {
    const input = taskSchema.parse(formDataToObject(fd));
    const { error } = await ctx.supabase.from("tasks").insert({ ...input, user_id: ctx.user.id, source: "manual" });
    const err = dbError(error);
    if (err) return err;
    rv(...taskPaths(input.prospect_id));
    return { ok: true };
  });
}

export async function setTaskCompleted(id: string, completed: boolean): Promise<ActionResult> {
  return withUser(async (ctx) => {
    z.uuid().parse(id);
    const { data, error } = await ctx.supabase
      .from("tasks")
      .update({ status: completed ? "completed" : "open", completed_at: completed ? new Date().toISOString() : null })
      .eq("id", id)
      .eq("user_id", ctx.user.id)
      .select("prospect_id")
      .maybeSingle();
    const err = dbError(error);
    if (err) return err;
    rv(...taskPaths(data?.prospect_id));
    return { ok: true };
  });
}

export async function rescheduleTask(id: string, dueDate: string): Promise<ActionResult> {
  return withUser(async (ctx) => {
    z.uuid().parse(id);
    const due = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(dueDate);
    const { data, error } = await ctx.supabase.from("tasks").update({ due_date: due }).eq("id", id).eq("user_id", ctx.user.id).select("prospect_id").maybeSingle();
    const err = dbError(error);
    if (err) return err;
    rv(...taskPaths(data?.prospect_id));
    return { ok: true };
  });
}

export async function deleteTask(id: string): Promise<ActionResult> {
  return withUser(async (ctx) => {
    z.uuid().parse(id);
    const { data, error } = await ctx.supabase.from("tasks").delete().eq("id", id).eq("user_id", ctx.user.id).select("prospect_id").maybeSingle();
    const err = dbError(error);
    if (err) return err;
    rv(...taskPaths(data?.prospect_id));
    return { ok: true };
  });
}
