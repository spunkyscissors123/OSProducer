"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "../auth";
import { parseProspectCsv } from "../domain/csv";
import { STAGE_DEFAULT_PROBABILITY } from "../domain/pipeline";
import { entitlementsFor } from "../plans";
import { rateLimit } from "../rate-limit";
import type { ActionResult, Subscription } from "../types";
import { prospectSchema } from "../validations";
import { dbError, formDataToObject, syncRenewalTasks, withUser } from "./helpers";

const revalidateAll = () => {
  for (const p of ["/dashboard", "/prospects", "/pipeline", "/renewals", "/tasks", "/finder", "/analytics"]) revalidatePath(p);
};

export async function createProspect(fd: FormData): Promise<ActionResult<{ id: string }>> {
  return withUser(async (ctx) => {
    const raw = formDataToObject(fd);
    const input = prospectSchema.parse(raw);
    const addToPipeline = raw.add_to_pipeline === "on" || raw.add_to_pipeline === "true";

    const { data, error } = await ctx.supabase.from("prospects").insert({ ...input, user_id: ctx.user.id, data_source: "user_entered" }).select("*").single();
    const err = dbError(error);
    if (err || !data) return err ?? { ok: false, error: "Could not save prospect." };

    if (addToPipeline) {
      const { error: oppErr } = await ctx.supabase.from("opportunities").insert({
        user_id: ctx.user.id,
        prospect_id: data.id,
        name: `${data.business_name} — commercial package`,
        stage: "new_prospect",
        estimated_premium: data.estimated_premium,
        coverage_lines: data.coverage_lines,
        close_probability: STAGE_DEFAULT_PROBABILITY.new_prospect,
        expected_close_date: data.renewal_date,
      });
      if (oppErr) console.error("[createProspect] opportunity", oppErr.message);
    }
    await syncRenewalTasks(ctx, data);
    await audit(ctx.supabase, ctx.user.id, "prospect.create", { type: "prospect", id: data.id });
    revalidateAll();
    return { ok: true, data: { id: data.id } };
  });
}

export async function updateProspect(id: string, fd: FormData): Promise<ActionResult<{ id: string }>> {
  return withUser(async (ctx) => {
    z.uuid().parse(id);
    const input = prospectSchema.parse(formDataToObject(fd));
    const { data, error } = await ctx.supabase.from("prospects").update(input).eq("id", id).eq("user_id", ctx.user.id).select("*").maybeSingle();
    const err = dbError(error);
    if (err) return err;
    if (!data) return { ok: false, error: "Prospect not found." };
    await syncRenewalTasks(ctx, data);
    await audit(ctx.supabase, ctx.user.id, "prospect.update", { type: "prospect", id });
    revalidateAll();
    revalidatePath(`/prospects/${id}`);
    return { ok: true, data: { id } };
  });
}

export async function setProspectArchived(id: string, archived: boolean): Promise<ActionResult> {
  return withUser(async (ctx) => {
    z.uuid().parse(id);
    const { data, error } = await ctx.supabase
      .from("prospects")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("id", id)
      .eq("user_id", ctx.user.id)
      .select("*")
      .maybeSingle();
    const err = dbError(error);
    if (err) return err;
    if (!data) return { ok: false, error: "Prospect not found." };
    await syncRenewalTasks(ctx, data); // archiving clears open renewal tasks; restoring rebuilds them
    await audit(ctx.supabase, ctx.user.id, archived ? "prospect.archive" : "prospect.restore", { type: "prospect", id });
    revalidateAll();
    revalidatePath(`/prospects/${id}`);
    return { ok: true };
  });
}

export async function importProspectsCsv(csvText: string, addToPipeline: boolean): Promise<ActionResult<{ imported: number; skipped: number; errors: { row: number; errors: string[] }[] }>> {
  return withUser(async (ctx) => {
    const rl = rateLimit(`import:${ctx.user.id}`, 10, 60 * 60 * 1000);
    if (!rl.ok) return { ok: false, error: `Import limit reached. Try again in ${Math.ceil(rl.retryAfterSec / 60)} minutes.` };
    if (typeof csvText !== "string" || csvText.length > 5_000_000) return { ok: false, error: "File is too large (5 MB max)." };

    const { data: sub } = await ctx.supabase.from("subscriptions").select("*").eq("user_id", ctx.user.id).maybeSingle();
    const ent = entitlementsFor(sub as Subscription | null);
    if (!ent.features.includes("csv_import") || ent.csvRowsPerImport <= 0) {
      return { ok: false, error: "CSV import requires an active plan. Visit Billing to subscribe." };
    }

    const parsed = parseProspectCsv(csvText, ent.csvRowsPerImport);
    const valid = parsed.rows.filter((r) => r.ok && r.data).map((r) => r.data!);
    if (!valid.length) return { ok: false, error: "No valid rows found. Check that a Business Name column exists." };

    const { data: inserted, error } = await ctx.supabase
      .from("prospects")
      .insert(valid.map((v) => ({ ...v, user_id: ctx.user.id, data_source: "csv_import" as const, lead_source: v.lead_source ?? "CSV import" })))
      .select("id, business_name, renewal_date, renewal_date_status, archived_at, estimated_premium, coverage_lines");
    const err = dbError(error, "Import failed — no rows were saved.");
    if (err || !inserted) return err ?? { ok: false, error: "Import failed." };

    if (addToPipeline) {
      await ctx.supabase.from("opportunities").insert(
        inserted.map((p) => ({
          user_id: ctx.user.id, prospect_id: p.id, name: `${p.business_name} — commercial package`, stage: "new_prospect" as const,
          estimated_premium: p.estimated_premium, coverage_lines: p.coverage_lines, close_probability: STAGE_DEFAULT_PROBABILITY.new_prospect,
        })),
      );
    }
    for (const p of inserted) if (p.renewal_date) await syncRenewalTasks(ctx, p);

    await audit(ctx.supabase, ctx.user.id, "prospect.import", { type: "prospect" }, { imported: inserted.length, skipped: parsed.invalidCount });
    revalidateAll();
    return {
      ok: true,
      data: {
        imported: inserted.length,
        skipped: parsed.invalidCount + Math.max(0, parsed.rows.length - parsed.validCount - parsed.invalidCount),
        errors: parsed.rows.filter((r) => !r.ok).slice(0, 50).map((r) => ({ row: r.row, errors: r.errors ?? [] })),
      },
    };
  });
}

const contactSchema = z.object({
  prospect_id: z.uuid(),
  name: z.string().trim().min(1, "Name is required").max(120),
  title: z.string().trim().max(120).optional().transform((v) => v || null),
  email: z.union([z.literal(""), z.email()]).optional().transform((v) => v || null),
  phone: z.string().trim().max(40).optional().transform((v) => v || null),
});

export async function addContact(fd: FormData): Promise<ActionResult> {
  return withUser(async (ctx) => {
    const input = contactSchema.parse(formDataToObject(fd));
    const { error } = await ctx.supabase.from("contacts").insert({ ...input, user_id: ctx.user.id });
    const err = dbError(error);
    if (err) return err;
    revalidatePath(`/prospects/${input.prospect_id}`);
    return { ok: true };
  });
}

export async function deleteContact(id: string, prospectId: string): Promise<ActionResult> {
  return withUser(async (ctx) => {
    z.uuid().parse(id);
    const { error } = await ctx.supabase.from("contacts").delete().eq("id", id).eq("user_id", ctx.user.id);
    const err = dbError(error);
    if (err) return err;
    revalidatePath(`/prospects/${prospectId}`);
    return { ok: true };
  });
}
