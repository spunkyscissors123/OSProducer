import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "@/components/app/auth-forms";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Reset your password</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">We&apos;ll email you a secure link to choose a new password.</p>
      <ForgotForm />
      <p className="mt-6 text-center text-sm"><Link href="/login" className="text-primary hover:underline">Back to log in</Link></p>
    </>
  );
}
