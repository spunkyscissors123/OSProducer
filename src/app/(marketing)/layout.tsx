import Link from "next/link";
import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-sidebar/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" aria-label="ProducerOS home"><Logo /></Link>
          <nav className="ml-auto flex items-center gap-1 text-sm sm:gap-2" aria-label="Primary">
            <Link href="/pricing" className="hidden rounded-md px-3 py-2 text-sidebar-foreground hover:text-white sm:block">Pricing</Link>
            <Link href="/demo/dashboard" className="hidden rounded-md px-3 py-2 text-sidebar-foreground hover:text-white sm:block">Live demo</Link>
            <Link href="/login" className="rounded-md px-3 py-2 text-sidebar-foreground hover:text-white">Log in</Link>
            <Button asChild size="sm" variant="teal"><Link href="/signup">Start free trial</Link></Button>
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} ProducerOS · Prospect Smarter. Produce More.</p>
          <div className="flex gap-4"><Link href="/pricing" className="hover:text-foreground">Pricing</Link><Link href="/demo/dashboard" className="hover:text-foreground">Demo</Link><Link href="/login" className="hover:text-foreground">Log in</Link></div>
        </div>
      </footer>
    </div>
  );
}
