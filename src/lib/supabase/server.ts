import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { publicEnv, requireServerEnv } from "../env";

/** Per-request client bound to the user's session cookies. All queries run under RLS as that user. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component — the proxy refreshes sessions, so this is safe to ignore.
        }
      },
    },
  });
}

/**
 * Service-role client. BYPASSES RLS — use ONLY for trusted server-to-server work
 * (Stripe webhook / customer creation). Never import from client components.
 */
export function createAdminClient() {
  return createSupabaseClient(publicEnv.supabaseUrl, requireServerEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
