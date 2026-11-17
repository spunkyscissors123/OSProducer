"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/primitives";
import { requestPasswordReset, signIn, signUp, updatePassword, type AuthState } from "@/lib/actions/auth";

function Status({ state }: { state: AuthState }) {
  if (state?.error) return <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>;
  if (state?.message) return <p role="status" className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{state.message}</p>;
  return null;
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signIn, undefined);
  return (
    <form action={action} className="grid gap-4">
      <Status state={state} />
      <input type="hidden" name="next" value={next ?? "/dashboard"} />
      <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
      <Field label="Password" htmlFor="password" hint={<Link href="/forgot-password" className="text-primary hover:underline">Forgot password?</Link>}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" size="lg" disabled={pending}>{pending && <Loader2 className="animate-spin" />} Log in</Button>
    </form>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState(signUp, undefined);
  return (
    <form action={action} className="grid gap-4">
      <Status state={state} />
      <Field label="Full name" htmlFor="full_name"><Input id="full_name" name="full_name" autoComplete="name" required maxLength={120} /></Field>
      <Field label="Work email" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
      <Field label="Password" htmlFor="password" hint="At least 10 characters"><Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} /></Field>
      <Button type="submit" size="lg" disabled={pending}>{pending && <Loader2 className="animate-spin" />} Create account</Button>
      <p className="text-center text-xs text-muted-foreground">We&apos;ll send a verification email to confirm your address.</p>
    </form>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);
  return (
    <form action={action} className="grid gap-4">
      <Status state={state} />
      <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
      <Button type="submit" size="lg" disabled={pending}>{pending && <Loader2 className="animate-spin" />} Send reset link</Button>
    </form>
  );
}

export function ResetForm() {
  const [state, action, pending] = useActionState(updatePassword, undefined);
  return (
    <form action={action} className="grid gap-4">
      <Status state={state} />
      <Field label="New password" htmlFor="password" hint="At least 10 characters"><Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} /></Field>
      <Field label="Confirm password" htmlFor="confirm"><Input id="confirm" name="confirm" type="password" autoComplete="new-password" required /></Field>
      <Button type="submit" size="lg" disabled={pending}>{pending && <Loader2 className="animate-spin" />} Update password</Button>
    </form>
  );
}
