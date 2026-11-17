import "server-only";
import { z } from "zod";
import { AuthError, getUserOrThrow } from "../auth";
import { flattenErrors } from "../validations";
import type { ActionResult } from "../types";
import { today } from "../domain/dates";
import { planRenewalTasks } from "../domain/renewals";
import type { Prospect } from "../types";

export type Ctx = Awaited<ReturnType<typeof getUserOrThrow>>;

/** Wraps a server action: authenticates, converts thrown errors into safe user-facing messages. */
export async function withUser<T>(fn: (ctx: Ctx) => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    const ctx = await getUserOrThrow();
    return await fn(ctx);
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.message };
    if (e instanceof z.ZodError) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: flattenErrors(e) };
    console.error("[action]", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export function dbError(error: { message: string; code?: string } | null, fallback = "Could not save changes."): ActionResult<never> | null {
  if (!error) return null;
  console.error("[db]", error.code, error.message);
  if (error.code === "23514") return { ok: false, error: "Some values are out of range." };
  if (error.code === "42501") return { ok: false, error: "You don't have access to that record." };
  if (error.code === "P0002") return { ok: false, error: "Record not found." };
  return { ok: false, error: fallback };
}

/** Recalculates a prospect's renewal outreach tasks atomically (no duplicates — see sync_renewal_tasks). */
export async function syncRenewalTasks(ctx: Ctx, p: Pick<Prospect, "id" | "business_name" | "renewal_date" | "renewal_date_status" | "archived_at">) {
  const { data: settings } = await ctx.supabase.from("user_settings").select("renewal_offsets, auto_renewal_tasks").eq("user_id", ctx.user.id).maybeSingle();
  const offsets: number[] = settings?.renewal_offsets ?? [120, 90, 60, 30];
  const enabled = settings?.auto_renewal_tasks ?? true;
  const active = enabled && !p.archived_at && p.renewal_date_status !== "unknown" && p.renewal_date;
  const tasks = active
    ? planRenewalTasks({ businessName: p.business_name, renewalDate: p.renewal_date, renewalStatus: p.renewal_date_status, offsets, todayIso: today() })
    : [];
  const { data, error } = await ctx.supabase.rpc("sync_renewal_tasks", {
    p_prospect_id: p.id,
    p_cycle_date: active && tasks.length ? p.renewal_date : null,
    p_offsets: offsets,
    p_tasks: tasks,
  });
  if (error) console.error("[renewal sync]", error.message);
  return (data as number | null) ?? 0;
}

export function formDataToObject(fd: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("$ACTION")) continue;
    if (k.endsWith("[]")) {
      const key = k.slice(0, -2);
      (obj[key] = (obj[key] as unknown[]) ?? []).push(v);
    } else obj[k] = v;
  }
  return obj;
}
