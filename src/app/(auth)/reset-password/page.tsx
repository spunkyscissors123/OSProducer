import type { Metadata } from "next";
import { ResetForm } from "@/components/app/auth-forms";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Choose a new password</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">You opened a secure reset link. Set your new password below.</p>
      <ResetForm />
    </>
  );
}
