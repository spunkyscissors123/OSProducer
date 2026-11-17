import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRightLeft, ExternalLink, FileText, Handshake, Mail, Pencil, PhoneCall, Sparkles, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/overlay";
import { CoverageChips, DataSourceBadge, EstimateNote, RenewalBadge, StageBadge, UnknownValue } from "@/components/app/bits";
import { ActivityLogger, AddToPipelineButton, ArchiveButton, ContactsPanel, NewTaskDialog, OpportunityPanel } from "@/components/app/crm-forms";
import { TaskList } from "@/components/app/task-list";
import { formatDate } from "@/lib/domain/dates";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { ActivityType } from "@/lib/types";
import type { ViewProps } from "./types";

const ICON: Record<ActivityType, React.ReactNode> = {
  call: <PhoneCall />, email: <Mail />, meeting: <Handshake />, note: <StickyNote />, stage_change: <ArrowRightLeft />, system: <FileText />,
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}
const val = (v: string | number | null | undefined, fmt?: (x: never) => string) => (v === null || v === undefined || v === "" ? <UnknownValue /> : fmt ? fmt(v as never) : String(v));

export async function ProspectDetailView({ repo, params }: ViewProps) {
  const [detail, settings] = await Promise.all([params?.id ? repo.getProspect(params.id) : null, repo.getSettings()]);
  if (!detail) notFound();
  const { prospect: p, activities, tasks, opportunities, contacts } = detail;
  const h = (x: string) => `${repo.basePath}${x}`;
  const openTasks = tasks.filter((t) => t.status === "open");
  const doneTasks = tasks.filter((t) => t.status === "completed");

  return (
    <>
      <Link href={h("/prospects")} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Prospects</Link>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{p.business_name}</h1>
            {p.archived_at && <Badge variant="muted">Archived</Badge>}
            <StageBadge stage={opportunities[0]?.stage ?? null} />
            <DataSourceBadge source={p.data_source} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {p.industry ?? "Industry unknown"} · {[p.city, p.state].filter(Boolean).join(", ") || "Location unknown"} · Added {formatDate(p.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="teal"><Link href={h(`/assistant?prospect=${p.id}&kind=intro_email`)}><Sparkles /> Generate outreach</Link></Button>
          {opportunities.length === 0 && <AddToPipelineButton prospectId={p.id} />}
          <Button asChild variant="outline"><Link href={h(`/prospects/${p.id}/edit`)}><Pencil /> Edit</Link></Button>
          <ArchiveButton id={p.id} archived={!!p.archived_at} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid min-w-0 content-start gap-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs font-medium text-muted-foreground">Renewal date</p>
              <div className="mt-1.5"><RenewalBadge date={p.renewal_date} status={p.renewal_date_status} todayIso={repo.todayIso} /></div>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-medium text-muted-foreground">Est. annual premium</p>
              <p className="mt-1 font-display text-xl font-bold tabular">{p.estimated_premium !== null ? formatCurrency(p.estimated_premium) : <UnknownValue />}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-medium text-muted-foreground">Next follow-up</p>
              <p className="mt-1 text-sm font-semibold">{p.next_follow_up_date ? formatDate(p.next_follow_up_date) : <UnknownValue>Not set</UnknownValue>}</p>
              <p className="text-xs text-muted-foreground">Last contact: {p.last_contacted_at ? formatDate(p.last_contacted_at) : "never"}</p>
            </Card>
          </div>

          <Card>
            <Tabs defaultValue="activity">
              <CardHeader className="pb-0">
                <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
                  <TabsTrigger value="activity">Activity</TabsTrigger>
                  <TabsTrigger value="log">Log activity</TabsTrigger>
                  <TabsTrigger value="tasks">Tasks ({openTasks.length})</TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent className="pt-0">
                <TabsContent value="activity">
                  {activities.length ? (
                    <ol className="relative ml-2 grid gap-5 border-l pl-6">
                      {activities.map((a) => (
                        <li key={a.id} className="relative">
                          <span className="absolute -left-[37px] flex size-6 items-center justify-center rounded-full border bg-card text-muted-foreground [&_svg]:size-3.5">{ICON[a.type]}</span>
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p className="text-sm font-medium">{a.subject}</p>
                            <time className="text-xs text-muted-foreground tabular">{formatDate(a.occurred_at, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</time>
                          </div>
                          {a.body && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="py-8 text-center text-sm text-muted-foreground">No activity yet. Use “Log activity” to record a call, email, meeting or note.</p>
                  )}
                </TabsContent>
                <TabsContent value="log"><ActivityLogger prospectId={p.id} /></TabsContent>
                <TabsContent value="tasks">
                  <div className="mb-2 flex justify-end"><NewTaskDialog prospectId={p.id} defaultDate={repo.todayIso} /></div>
                  <TaskList tasks={openTasks} todayIso={repo.todayIso} showProspect={false} emptyText="No open tasks." />
                  {doneTasks.length > 0 && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm text-muted-foreground">Completed ({doneTasks.length})</summary>
                      <TaskList tasks={doneTasks} todayIso={repo.todayIso} showProspect={false} />
                    </details>
                  )}
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>

          {p.notes && (
            <Card>
              <CardHeader><CardTitle>Prospecting notes</CardTitle></CardHeader>
              <CardContent><p className="whitespace-pre-wrap text-sm leading-relaxed">{p.notes}</p></CardContent>
            </Card>
          )}
        </div>

        <div className="grid content-start gap-5">
          <Card>
            <CardHeader><CardTitle>Opportunities</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              {opportunities.length ? opportunities.map((o) => (
                <OpportunityPanel key={o.id} opp={o} rate={settings.agency_commission_rate} nbSplit={settings.new_business_split} renewalSplit={settings.renewal_split} />
              )) : <p className="text-sm text-muted-foreground">Not in the pipeline yet.</p>}
              <EstimateNote />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Insurance</CardTitle></CardHeader>
            <CardContent>
              <dl className="divide-y">
                <Row label="Current carrier">{val(p.current_carrier)}</Row>
                <Row label="Agency / broker">{val(p.current_agency)}</Row>
                <Row label="Coverage">{<CoverageChips lines={p.coverage_lines} max={8} />}</Row>
                <Row label="Lead source">{val(p.lead_source)}</Row>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Business</CardTitle></CardHeader>
            <CardContent>
              <dl className="divide-y">
                <Row label="Website">{p.website ? <a href={p.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-primary hover:underline">{p.website.replace(/^https?:\/\//, "")} <ExternalLink className="size-3" /></a> : <UnknownValue />}</Row>
                <Row label="Address">{p.address || p.zip ? `${p.address ?? ""} ${p.city ?? ""} ${p.state ?? ""} ${p.zip ?? ""}`.trim() : <UnknownValue />}</Row>
                <Row label="Employees">{val(p.employee_count, (n: number) => formatNumber(n))}</Row>
                <Row label="Annual revenue">{val(p.annual_revenue, (n: number) => formatCurrency(n))}</Row>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Contacts</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              <dl className="divide-y">
                <Row label="Primary">{p.contact_name ? `${p.contact_name}${p.contact_title ? `, ${p.contact_title}` : ""}` : <UnknownValue />}</Row>
                <Row label="Email">{p.contact_email ? <a href={`mailto:${p.contact_email}`} className="text-primary hover:underline">{p.contact_email}</a> : <UnknownValue />}</Row>
                <Row label="Phone">{p.contact_phone ? <a href={`tel:${p.contact_phone}`} className="text-primary hover:underline">{p.contact_phone}</a> : <UnknownValue />}</Row>
              </dl>
              <ContactsPanel prospectId={p.id} contacts={contacts} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
