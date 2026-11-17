import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "./supabase/server";
import { isSupabaseConfigured } from "./env";

/** For pages: returns the authenticated user + RLS-bound client, or redirects to login. */
export const requireUser = cache(async () => {
  if (!isSupabaseConfigured()) redirect("/login?setup=1");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
});

export class AuthError extends Error {}

/** For server actions / route handlers: throws instead of redirecting. */
export async function getUserOrThrow() {
  if (!isSupabaseConfigured()) throw new AuthError("Authentication is not configured");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AuthError("You must be signed in");
  return { supabase, user };
}

type Supa = Awaited<ReturnType<typeof createClient>>;

/** Append-only audit trail. Never throws — auditing must not break the user's action. */
export async function audit(supabase: Supa, userId: string, action: string, entity?: { type: string; id?: string | null }, metadata: Record<string, unknown> = {}) {
  try {
    await supabase.from("audit_logs").insert({ user_id: userId, action, entity_type: entity?.type ?? null, entity_id: entity?.id ?? null, metadata });
  } catch (e) {
    console.error("audit log failed", e);
  }
}
