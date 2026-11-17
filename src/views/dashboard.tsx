import Link from "next/link";
import { AlertCircle, ArrowRight, Briefcase, CalendarCheck, DollarSign, FileText, Handshake, MessageSquare, PhoneCall, Mail, Plus, Sparkles, StickyNote, Trophy, UserPlus, Users, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState } from "@/components/ui/primitives";
import { EstimateNote, KpiCard, PageHeader, RenewalBadge } from "@/components/app/bits";
import { MonthlyProductionChart } from "@/components/app/charts";
import { TaskList } from "@/components/app/task-list";
import { computeKpis, dailyAttention, monthlyProduction, recentActivity, upcomingRenewals } from "@/lib/domain/dashboard";
import { stageStats } from "@/lib/domain/pipeline";
import { formatDate } from "@/lib/domain/dates";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { OPEN_STAGES, type ActivityType } from "@/lib/types";
import type { ViewProps } from "./types";

const ACTIVITY_ICON: Record<ActivityType, React.ReactNode> = {
  call: <PhoneCall />, email: <Mail />, meeting: <Handshake />, note: <StickyNote />, stage_change: <ArrowRightLeft />, system: <FileText />,
};

export async function DashboardView({ repo }: ViewProps) {
  const [profile, settings, prospects, opps, tasks, activities] = await Promise.all([
    repo.getProfile(), repo.getSettings(), repo.listActiveProspects(), repo.listOpportunities(), repo.listTasks(), repo.listActivities(12),
  ]);
  const t = repo.todayIso;
  const h = (p: string) => `${repo.basePath}${p}`;
  const k = computeKpis(prospects, opps, settings, t);
  const attention = dailyAttention(tasks, prospects, t);
  const renewals = upcomingRenewals(prospects, t, 6);
  const production = monthlyProduction(opps, settings, t);
  const stages = stageStats(opps, settings.agency_commission_rate, settings.new_business_split).filter((s) => (OPEN_STAGES as string[]).includes(s.stage));
  const maxStage = Math.max(1, ...stages.map((s) => s.count));
  const firstName = profile.full_name?.split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  if (prospects.length === 0 && repo.mode === "live") {
    return (
      <>
        <PageHeader title={`Welcome${firstName ? `, ${firstName}` : ""}`} description="Let's build your prospect book." />
        <Card>
          <EmptyState
            icon={<Users />}
            title="No prospects yet"
            description="Add your first prospect manually or import a CSV list. Renewal tasks are created automatically when you enter a renewal date."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild><Link href="/prospects/new"><Plus /> Add prospect</Link></Button>
                <Button asChild variant="outline"><Link href="/prospects/import">Import CSV</Link></Button>
                <Button asChild variant="ghost"><Link href="/demo/dashboard">Explore the demo</Link></Button>
              </div>
            }
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`${greeting}${firstName ? `, ${firstName}` : ""}`}
        description={`${formatDate(t, { weekday: "long", month: "long", day: "numeric" })} · ${attention.dueToday.length} due today · ${attention.overdue.length} overdue`}
        actions={
          <>
            <Button asChild variant="outline"><Link href={h("/assistant")}><Sparkles className="text-teal" /> AI assistant</Link></Button>
            <Button asChild><Link href={h("/prospects/new")}><Plus /> Quick add prospect</Link></Button>
          </>
        }
      />

      <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Active prospects" value={formatNumber(k.activeProspects)} sub={`${k.newThisMonth} new this month`} icon={<Users />} href={h("/prospects")} />
        <KpiCard label="New this month" value={formatNumber(k.newThisMonth)} sub="Prospects added" icon={<UserPlus />} accent="teal" />
        <KpiCard label="Prospects contacted" value={formatNumber(k.contacted)} sub={`${k.contactedThisMonth} this month`} icon={<MessageSquare />} accent="slate" />
        <KpiCard label="Meetings scheduled" value={formatNumber(k.meetingsScheduled)} sub="In Meeting Scheduled stage" icon={<CalendarCheck />} href={h("/pipeline")} accent="teal" />
        <KpiCard label="Being quoted" value={formatNumber(k.quoting)} sub="In Quoting stage" icon={<Briefcase />} href={h("/pipeline")} accent="slate" />
        <KpiCard label="Premium pipeline" value={formatCurrency(k.premiumPipeline, { compact: true })} sub="Open opportunities (est.)" icon={<DollarSign />} />
        <KpiCard label="Commission pipeline" value={formatCurrency(k.commissionPipeline, { compact: true })} sub={`Est. at ${settings.agency_commission_rate}% × ${settings.new_business_split}% split`} icon={<DollarSign />} accent="teal" />
        <KpiCard label="Closed this year" value={formatCurrency(k.closedPremiumYtd, { compact: true })} sub={`${k.closedCountYtd} account${k.closedCountYtd === 1 ? "" : "s"} won (est. premium)`} icon={<Trophy />} accent="green" href={h("/analytics")} />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>Today&apos;s prospecting</CardTitle>
              <CardDescription>Follow-ups due today and over the past days</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm"><Link href={h("/tasks")}>All tasks <ArrowRight /></Link></Button>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <div>
              <h4 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Due today <span className="rounded bg-muted px-1.5 tabular">{attention.dueToday.length}</span></h4>
              <TaskList tasks={attention.dueToday.slice(0, 6)} todayIso={t} compact emptyText="Nothing due today. 🎯" />
            </div>
            <div>
              <h4 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-destructive">
                <AlertCircle className="size-3.5" /> Overdue <span className="rounded bg-destructive/10 px-1.5 tabular">{attention.overdue.length}</span>
              </h4>
              <TaskList tasks={attention.overdue.slice(0, 6)} todayIso={t} compact emptyText="You're all caught up." />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>Upcoming renewals</CardTitle>
              <CardDescription>Known & estimated dates in the next 120 days</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm"><Link href={h("/renewals")}>Calendar <ArrowRight /></Link></Button>
          </CardHeader>
          <CardContent>
            {renewals.length ? (
              <ul className="divide-y">
                {renewals.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Link href={h(`/prospects/${p.id}`)} className="block truncate text-sm font-medium hover:text-primary">{p.business_name}</Link>
                      <p className="truncate text-xs text-muted-foreground">{p.industry ?? "Industry unknown"} · {formatCurrency(p.estimated_premium, { compact: true })}</p>
                    </div>
                    <RenewalBadge date={p.renewal_date} status={p.renewal_date_status} todayIso={t} showDate={false} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">No renewals in the next 120 days.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>Monthly production</CardTitle>
              <CardDescription>Closed (won) premium, trailing 12 months — hover for est. commission</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <MonthlyProductionChart data={production} />
            <EstimateNote className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>Sales pipeline</CardTitle>
              <CardDescription>Open opportunities by stage</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm"><Link href={h("/pipeline")}>Board <ArrowRight /></Link></Button>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2.5">
              {stages.map((s) => (
                <li key={s.stage}>
                  <div className="mb-1 flex items-baseline justify-between text-xs">
                    <span className="font-medium">{s.label}</span>
                    <span className="text-muted-foreground tabular">{s.count} · {formatCurrency(s.premium, { compact: true })}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-gradient-to-r from-primary to-teal transition-all duration-700" style={{ width: `${(s.count / maxStage) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Calls, emails, meetings and stage changes</CardDescription>
          </CardHeader>
          <CardContent>
            {activities.length ? (
              <ol className="relative grid gap-4 border-l pl-5">
                {recentActivity(activities, 7).map((a) => (
                  <li key={a.id} className="relative">
                    <span className="absolute -left-[31px] flex size-[22px] items-center justify-center rounded-full border bg-card text-muted-foreground [&_svg]:size-3">{ACTIVITY_ICON[a.type]}</span>
                    <p className="text-sm"><span className="font-medium">{a.subject}</span></p>
                    <p className="text-xs text-muted-foreground">
                      <Link href={h(`/prospects/${a.prospect_id}`)} className="hover:text-primary hover:underline">{a.prospect?.business_name}</Link> · {formatDate(a.occurred_at, { month: "short", day: "numeric" })}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">Log a call, email or meeting from any prospect profile.</p>
            )}
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-card via-card to-accent/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-teal" /> AI prospecting assistant</CardTitle>
            <CardDescription>Draft personalized outreach from the facts you&apos;ve recorded — never invented ones.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {attention.renewalOutreachOverdue.slice(0, 3).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border bg-card/80 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.business_name}</p>
                  <p className="text-xs text-muted-foreground">Renewal soon · not contacted in 30+ days</p>
                </div>
                <Button asChild size="sm" variant="teal"><Link href={h(`/assistant?prospect=${p.id}&kind=intro_email`)}>Generate outreach</Link></Button>
              </div>
            ))}
            <Button asChild variant="outline" className="justify-self-start"><Link href={h("/assistant")}>Open assistant <ArrowRight /></Link></Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
