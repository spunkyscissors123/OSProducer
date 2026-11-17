import Link from "next/link";
import { Logo } from "@/components/app/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-white lg:flex">
        <div className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_50%_at_100%_0%,rgba(45,212,191,0.18),transparent_60%),radial-gradient(60%_60%_at_0%_100%,rgba(59,130,246,0.22),transparent_60%)]" />
        <Link href="/" className="relative"><Logo /></Link>
        <div className="relative">
          <p className="font-display text-3xl font-bold leading-tight">Prospect smarter.<br />Produce more.</p>
          <p className="mt-3 max-w-md text-sidebar-foreground">Renewal intelligence, a pipeline you&apos;ll actually use, and AI outreach grounded in your own data.</p>
        </div>
        <p className="relative text-xs text-sidebar-muted">Your data is isolated with row-level security.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-8 inline-block lg:hidden"><Logo tone="dark" /></Link>
          {children}
        </div>
      </div>
    </div>
  );
}
