import Link from "next/link";
import { AlertTriangle, CalendarClock, CircleHelp, Settings2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/primitives";
import { PageHeader, RenewalBadge, UnknownValue } from "@/components/app/bits";
import { RenewalCalendar } from "@/components/app/renewal-calendar";
import { RecalculateButton } from "@/components/app/settings-forms";
import { groupByRenewalWindow, isOutreachOverdue } from "@/lib/domain/renewals";
import { formatDate, monthLabel } from "@/lib/domain/dates";
import { cn, formatCurrency } from "@/lib/utils";
import type { Prospect } from "@/lib/types";
import { sp, type ViewProps } from "./types";

const WINDOWS = [
  { key: "d30", label: "Next 30 days", tone: "border-destructive/40 bg-destructive/5" },
  { key: "d60", label: "31–60 days", tone: "border-warning/40 bg-warning/5" },
  { key: "d90", label: "61–90 days", tone: "border-primary/30 bg-primary/5" },
  { key: "d120", label: "91–120 days", tone: "border-teal/30 bg-accent/40" },
] as const;

export async function RenewalsView({ repo, searchParams }: ViewProps) {
  const [prospects, settings] = await Promise.all([repo.listActiveProspects(), repo.getSettings()]);
  const t = repo.todayIso;
  const h = (p: string) => `${repo.basePath}${p}`;
  const g = groupByRenewalWindow(prospects, t);
  const overdue = prospects.filter((p) => isOutreachOverdue(p, t)).sort((a, b) => (a.renewal_date ?? "").localeCompare(b.renewal_date ?? ""));
  const selected = (sp(searchParams, "window") as (typeof WINDOWS)[number]["key"]) ?? "d30";
  const list: Prospect[] = g[selected] ?? g.d30;
  const withDates = prospects.filter((p) => p.renewal_date && p.renewal_date >= t);
  const byMonth = new Map<string, Prospect[]>();
  for (const p of withDates.sort((a, b) => a.renewal_date!.localeCompare(b.renewal_date!))) {
    const k = p.renewal_date!.slice(0, 7);
    byMonth.set(k, [...(byMonth.get(k) ?? []), p]);
  }

  return (
    <>
      <PageHeader
        title="Renewal calendar"
        description={`Outreach is scheduled at ${settings.renewal_offsets.join(", ")} days before each known or estimated renewal. Unknown dates are never guessed.`}
        actions={
          <>
            <RecalculateButton />
            <Button asChild variant="outline"><Link href={h("/settings")}><Settings2 /> Schedule settings</Link></Button>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Renewal windows">
        {WINDOWS.map((w) => {
          const items = g[w.key];
          return (
            <Link key={w.key} href={h(`/renewals?window=${w.key}`)} scroll={false} aria-current={selected === w.key ? "true" : undefined}
              className={cn("rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md", w.tone, selected === w.key && "ring-2 ring-primary")}
            >
              <p className="text-xs font-medium text-muted-foreground">{w.label}</p>
              <p className="mt-1 font-display text-2xl font-bold tabular">{items.length}</p>
              <p className="text-xs text-muted-foreground tabular">{formatCurrency(items.reduce((s, p) => s + (p.estimated_premium ?? 0), 0), { compact: true })} est. premium</p>
            </Link>
          );
        })}
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Card>
          <CardHeader>
            <CardTitle>{WINDOWS.find((w) => w.key === selected)?.label ?? "Next 30 days"}</CardTitle>
            <CardDescription>Renewing prospects in this window, soonest first</CardDescription>
          </CardHeader>
          <CardContent>
            {list.length ? (
              <ul className="divide-y">
                {[...list].sort((a, b) => a.renewal_date!.localeCompare(b.renewal_date!)).map((p) => (
                  <li key={p.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <Link href={h(`/prospects/${p.id}`)} className="font-medium hover:text-primary">{p.business_name}</Link>
                      <p className="text-xs text-muted-foreground">
                        {p.current_carrier ? `Incumbent: ${p.current_carrier}` : "Incumbent carrier unknown"} · {formatCurrency(p.estimated_premium)} · Last contact {p.last_contacted_at ? formatDate(p.last_contacted_at, { month: "short", day: "numeric" }) : "never"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <RenewalBadge date={p.renewal_date} status={p.renewal_date_status} todayIso={t} />
                      <Button asChild size="icon-sm" variant="ghost" aria-label={`Generate outreach for ${p.business_name}`}><Link href={h(`/assistant?prospect=${p.id}&kind=intro_email`)}><Sparkles className="text-teal" /></Link></Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No renewals in this window.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="size-4 text-destructive" /> Overdue outreach</CardTitle>
            <CardDescription>Renewing within 120 days and not contacted in 30+ days</CardDescription>
          </CardHeader>
          <CardContent>
            {overdue.length ? (
              <ul className="divide-y">
                {overdue.slice(0, 10).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-2.5">
                    <Link href={h(`/prospects/${p.id}`)} className="min-w-0 truncate text-sm font-medium hover:text-primary">{p.business_name}</Link>
                    <RenewalBadge date={p.renewal_date} status={p.renewal_date_status} todayIso={t} showDate={false} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">No overdue outreach. Nice work.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarClock className="size-4 text-primary" /> Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <RenewalCalendar items={withDates.map((p) => ({ id: p.id, business_name: p.business_name, renewal_date: p.renewal_date!, renewal_date_status: p.renewal_date_status, estimated_premium: p.estimated_premium }))} todayIso={t} />
        </CardContent>
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By renewal month</CardTitle>
            <CardDescription>Organize prospecting by when accounts renew</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {[...byMonth].slice(0, 12).map(([k, ps]) => (
              <Link key={k} href={h(`/prospects?renewalMonth=${k.slice(5, 7)}&sort=renewal_asc`)} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-muted">
                <span className="font-medium">{monthLabel(k, "long")}</span>
                <span className="text-muted-foreground tabular">{ps.length} · {formatCurrency(ps.reduce((s, p) => s + (p.estimated_premium ?? 0), 0), { compact: true })}</span>
              </Link>
            ))}
            {byMonth.size === 0 && <p className="text-sm text-muted-foreground">No upcoming renewal dates recorded.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CircleHelp className="size-4 text-muted-foreground" /> Renewal date unknown <Badge variant="muted">{g.unknown.length}</Badge></CardTitle>
            <CardDescription>Ask for these at your next touchpoint. ProducerOS won&apos;t estimate them.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {g.unknown.slice(0, 8).map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <Link href={h(`/prospects/${p.id}`)} className="truncate font-medium hover:text-primary">{p.business_name}</Link>
                  <UnknownValue />
                </li>
              ))}
            </ul>
            {g.passed.length > 0 && <p className="mt-3 text-xs text-warning">{g.passed.length} prospect(s) have a renewal date in the past — confirm their new dates.</p>}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
