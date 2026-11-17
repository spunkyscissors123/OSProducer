"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { publicEnv, isSupabaseConfigured } from "../env";
import { rateLimit } from "../rate-limit";
import { createClient } from "../supabase/server";

export type AuthState = { error?: string; message?: string } | undefined;

const email = z.email("Enter a valid email").max(254);
const password = z.string().min(10, "Use at least 10 characters").max(128);

async function clientKey(prefix: string) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
  return `${prefix}:${ip}`;
}

function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export async function signIn(_: AuthState, fd: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured()) return { error: "Supabase is not configured. See README → Setup." };
  const rl = rateLimit(await clientKey("login"), 10, 15 * 60 * 1000);
  if (!rl.ok) return { error: "Too many attempts. Please wait a few minutes." };
  const parsed = z.object({ email, password: z.string().min(1, "Password is required") }).safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Generic message — never reveal whether the account exists.
    if (error.message.toLowerCase().includes("email not confirmed")) return { error: "Please verify your email first — check your inbox." };
    return { error: "Invalid email or password." };
  }
  redirect(safeNext(fd.get("next")));
}

export async function signUp(_: AuthState, fd: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured()) return { error: "Supabase is not configured. See README → Setup." };
  const rl = rateLimit(await clientKey("signup"), 5, 60 * 60 * 1000);
  if (!rl.ok) return { error: "Too many sign-up attempts. Please try later." };
  const parsed = z
    .object({ full_name: z.string().trim().min(1, "Name is required").max(120), email, password })
    .safeParse({ full_name: fd.get("full_name"), email: fd.get("email"), password: fd.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.full_name }, emailRedirectTo: `${publicEnv.appUrl}/auth/confirm?next=/dashboard` },
  });
  if (error) {
    console.error("[signup]", error.message);
    if (error.message.toLowerCase().includes("password")) return { error: error.message };
    return { error: "Could not create account. Please try again." };
  }
  redirect(`/verify-email?email=${encodeURIComponent(parsed.data.email)}`);
}

export async function requestPasswordReset(_: AuthState, fd: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured()) return { error: "Supabase is not configured." };
  const rl = rateLimit(await clientKey("reset"), 5, 60 * 60 * 1000);
  if (!rl.ok) return { error: "Too many requests. Please try later." };
  const parsed = email.safeParse(fd.get("email"));
  if (!parsed.success) return { error: "Enter a valid email" };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo: `${publicEnv.appUrl}/auth/confirm?next=/reset-password` });
  return { message: "If an account exists for that email, a reset link is on its way." };
}

export async function updatePassword(_: AuthState, fd: FormData): Promise<AuthState> {
  const parsed = password.safeParse(fd.get("password"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (fd.get("password") !== fd.get("confirm")) return { error: "Passwords do not match" };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) return { error: "Could not update password. Your reset link may have expired." };
  redirect("/dashboard?passwordUpdated=1");
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
