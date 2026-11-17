import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";

export const metadata: Metadata = { title: "Verify your email" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return (
    <div className="text-center">
      <MailCheck className="mx-auto size-10 text-teal" />
      <h1 className="mt-4 text-2xl font-bold">Check your inbox</h1>
      <p className="mt-2 text-sm text-muted-foreground">We sent a verification link{email ? <> to <strong className="text-foreground">{email}</strong></> : ""}. Click it to activate your account.</p>
      <p className="mt-6 text-sm"><Link href="/login" className="text-primary hover:underline">Back to log in</Link></p>
    </div>
  );
}
