// Centralized env access. Server-only secrets are read lazily so missing values fail at use-time with clear messages.
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
};

export const isSupabaseConfigured = () => Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);

export function requireServerEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required server environment variable: ${name}`);
  return v;
}
