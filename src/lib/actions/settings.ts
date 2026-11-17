"use server";
import { revalidatePath } from "next/cache";
import { audit } from "../auth";
import type { ActionResult } from "../types";
import { settingsSchema } from "../validations";
import { dbError, syncRenewalTasks, withUser } from "./helpers";

export async function updateSettings(values: unknown): Promise<ActionResult<{ resynced: number }>> {
  return withUser(async (ctx) => {
    const input = settingsSchema.parse(values);
    const { full_name, agency_name, ...settings } = input;
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      ctx.supabase.from("profiles").update({ full_name, agency_name }).eq("id", ctx.user.id),
      ctx.supabase.from("user_settings").update(settings).eq("user_id", ctx.user.id),
    ]);
    const err = dbError(e1 ?? e2);
    if (err) return err;
    await audit(ctx.supabase, ctx.user.id, "settings.update", { type: "settings" });
    revalidatePath("/", "layout");
    return { ok: true, data: { resynced: 0 } };
  });
}

/** Re-applies the renewal schedule to every prospect with a known/estimated renewal date. Idempotent. */
export async function recalculateRenewalTasks(): Promise<ActionResult<{ created: number; prospects: number }>> {
  return withUser(async (ctx) => {
    const { data, error } = await ctx.supabase
      .from("prospects")
      .select("id, business_name, renewal_date, renewal_date_status, archived_at")
      .eq("user_id", ctx.user.id)
      .not("renewal_date", "is", null)
      .limit(5000);
    const err = dbError(error);
    if (err) return err;
    let created = 0;
    for (const p of data ?? []) created += await syncRenewalTasks(ctx, p);
    await audit(ctx.supabase, ctx.user.id, "renewals.recalculate", { type: "settings" }, { created, prospects: data?.length ?? 0 });
    revalidatePath("/tasks");
    revalidatePath("/renewals");
    revalidatePath("/dashboard");
    return { ok: true, data: { created, prospects: data?.length ?? 0 } };
  });
}
