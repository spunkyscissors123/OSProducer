import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/app/auth-forms";

export const metadata: Metadata = { title: "Start your free trial" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Start your free trial</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">14 days of Starter features. No credit card required.</p>
      <SignupForm />
      <p className="mt-6 text-center text-sm text-muted-foreground">Already have an account? <Link href="/login" className="font-medium text-primary hover:underline">Log in</Link></p>
    </>
  );
}
