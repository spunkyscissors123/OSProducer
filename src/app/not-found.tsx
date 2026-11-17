import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="font-display text-5xl font-extrabold text-primary">404</p>
      <h1 className="text-xl font-semibold">We couldn&apos;t find that page</h1>
      <p className="text-sm text-muted-foreground">It may have been archived, or you may not have access to it.</p>
      <Button asChild className="mt-2"><Link href="/dashboard">Go to dashboard</Link></Button>
    </main>
  );
}
