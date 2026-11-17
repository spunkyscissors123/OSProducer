import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/app/auth-forms";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; setup?: string }> }) {
  const sp = await searchParams;
  const configured = isSupabaseConfigured();
  return (
    <>
      <h1 className="text-2xl font-bold">Welcome back</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">Log in to your ProducerOS workspace.</p>
      {(!configured || sp.setup) && (
        <div className="mb-4 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          Supabase isn&apos;t configured yet. Add your keys to <code>.env.local</code> (see README). Meanwhile, <Link href="/demo/dashboard" className="font-semibold text-primary hover:underline">explore the demo</Link>.
        </div>
      )}
      {sp.error === "link_invalid" && <p className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">That link is invalid or has expired. Please try again.</p>}
      <LoginForm next={sp.next} />
      <p className="mt-6 text-center text-sm text-muted-foreground">New to ProducerOS? <Link href="/signup" className="font-medium text-primary hover:underline">Start a free trial</Link></p>
    </>
  );
}
