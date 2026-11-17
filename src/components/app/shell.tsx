"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTheme } from "next-themes";
import { Dialog as D } from "radix-ui";
import {
  BarChart3, Bell, CalendarClock, CreditCard, Kanban, LayoutDashboard, ListChecks, LogOut, Menu, Moon, Plus, Search, Settings, Sparkles, Sun, Telescope, Users,
} from "lucide-react";
import { Logo } from "./logo";
import { AppModeProvider } from "./mode";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, SheetContent } from "@/components/ui/overlay";
import { cn, initials } from "@/lib/utils";
import { signOut } from "@/lib/actions/auth";

export const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/prospects", label: "Prospects", icon: Users },
  { href: "/finder", label: "Prospect Finder", icon: Telescope },
  { href: "/pipeline", label: "Sales Pipeline", icon: Kanban },
  { href: "/renewals", label: "Renewal Calendar", icon: CalendarClock },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/assistant", label: "AI Assistant", icon: Sparkles },
  { href: "/analytics", label: "Production Analytics", icon: BarChart3 },
] as const;
const NAV_SECONDARY = [
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/billing", label: "Billing", icon: CreditCard },
] as const;

interface ShellProps {
  mode: "live" | "demo";
  basePath: "" | "/demo";
  user: { name: string | null; email: string | null; agency: string | null };
  planLabel: string;
  overdueCount: number;
  banner?: React.ReactNode;
  children: React.ReactNode;
}

function NavList({ basePath, overdueCount, onNavigate }: { basePath: string; overdueCount: number; onNavigate?: () => void }) {
  const path = usePathname();
  const item = ({ href, label, icon: Icon }: { href: string; label: string; icon: typeof Users }) => {
    const full = `${basePath}${href}`;
    const active = path === full || path.startsWith(`${full}/`);
    return (
      <li key={href}>
        <Link
          href={full}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={cn(
            "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors",
            active ? "bg-sidebar-active text-white" : "text-sidebar-foreground hover:bg-sidebar-active/60 hover:text-white",
          )}
        >
          {active && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-teal" aria-hidden />}
          <Icon className={cn("size-[18px] shrink-0", active ? "text-teal" : "text-sidebar-muted group-hover:text-sidebar-foreground")} />
          <span className="truncate">{label}</span>
          {href === "/tasks" && overdueCount > 0 && (
            <span className="ml-auto rounded-full bg-destructive/90 px-1.5 text-[10px] font-semibold text-white tabular" aria-label={`${overdueCount} overdue`}>
              {overdueCount}
            </span>
          )}
        </Link>
      </li>
    );
  };
  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
      <ul className="grid gap-0.5">{NAV.map(item)}</ul>
      <div>
        <p className="px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-sidebar-muted">Account</p>
        <ul className="grid gap-0.5">{NAV_SECONDARY.map(item)}</ul>
      </div>
    </nav>
  );
}

function SidebarBody({ basePath, overdueCount, planLabel, mode, onNavigate }: { basePath: string; overdueCount: number; planLabel: string; mode: string; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-16 items-center border-b border-sidebar-border px-5">
        <Link href={`${basePath}/dashboard`} onClick={onNavigate} aria-label="ProducerOS home">
          <Logo />
        </Link>
      </div>
      <NavList basePath={basePath} overdueCount={overdueCount} onNavigate={onNavigate} />
      <div className="m-3 rounded-xl border border-sidebar-border bg-sidebar-active/50 p-3.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-sidebar-muted">{mode === "demo" ? "Demo workspace" : "Plan"}</p>
        <p className="mt-0.5 text-sm font-semibold text-white">{planLabel}</p>
        {mode === "demo" ? (
          <Link href="/signup" className="mt-2.5 inline-flex text-xs font-semibold text-teal hover:underline">Create free account →</Link>
        ) : (
          <Link href="/billing" onClick={onNavigate} className="mt-2.5 inline-flex text-xs font-semibold text-teal hover:underline">Manage plan →</Link>
        )}
      </div>
    </div>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button variant="ghost" size="icon" aria-label="Toggle dark mode" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
    </Button>
  );
}

export function AppShell({ mode, basePath, user, planLabel, overdueCount, banner, children }: ShellProps) {
  const [open, setOpen] = useState(false);
  const display = user.name || user.email || "Producer";
  return (
    <AppModeProvider mode={mode} basePath={basePath}>
      <div className="min-h-dvh lg:pl-64">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
          <SidebarBody basePath={basePath} overdueCount={overdueCount} planLabel={planLabel} mode={mode} />
        </aside>

        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur-md sm:px-6">
          <D.Root open={open} onOpenChange={setOpen}>
            <D.Trigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                <Menu />
              </Button>
            </D.Trigger>
            <SheetContent title="Navigation">
              <SidebarBody basePath={basePath} overdueCount={overdueCount} planLabel={planLabel} mode={mode} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </D.Root>

          <form action={`${basePath}/prospects`} className="relative hidden max-w-sm flex-1 sm:block" role="search">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              placeholder="Search prospects…"
              aria-label="Search prospects"
              className="h-9 w-full rounded-lg border border-transparent bg-muted pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:bg-card"
            />
          </form>

          <div className="ml-auto flex items-center gap-1.5">
            {mode === "demo" && <Badge variant="teal" className="hidden sm:inline-flex">Demo · fictional data</Badge>}
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link href={`${basePath}/prospects/new`}>
                <Plus /> Add prospect
              </Link>
            </Button>
            <Button asChild size="icon" variant="ghost" className="sm:hidden" aria-label="Add prospect">
              <Link href={`${basePath}/prospects/new`}><Plus /></Link>
            </Button>
            <Button asChild size="icon" variant="ghost" aria-label={`Tasks${overdueCount ? `, ${overdueCount} overdue` : ""}`} className="relative">
              <Link href={`${basePath}/tasks`}>
                <Bell />
                {overdueCount > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-destructive ring-2 ring-background" />}
              </Link>
            </Button>
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="ml-1 flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-teal text-xs font-semibold text-white ring-offset-2 focus-visible:ring-2" aria-label="Account menu">
                  {initials(display)}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-60">
                <DropdownMenuLabel>
                  <span className="block truncate text-sm font-semibold text-foreground">{display}</span>
                  {user.agency && <span className="block truncate">{user.agency}</span>}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link href={`${basePath}/settings`}><Settings /> Settings</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href={`${basePath}/billing`}><CreditCard /> Billing</Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                {mode === "demo" ? (
                  <DropdownMenuItem asChild><Link href="/">Exit demo</Link></DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onSelect={() => void signOut()}><LogOut /> Sign out</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {banner}
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </AppModeProvider>
  );
}
