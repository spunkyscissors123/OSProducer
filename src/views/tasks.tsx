import Link from "next/link";
import { AlertCircle, CalendarDays, CheckCircle2, ListTodo, Sun } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/primitives";
import { KpiCard, PageHeader, RenewalBadge } from "@/components/app/bits";
import { NewTaskDialog } from "@/components/app/crm-forms";
import { TaskList } from "@/components/app/task-list";
import { dailyAttention } from "@/lib/domain/dashboard";
import { addDays, formatDate } from "@/lib/domain/dates";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";
import { sp, type ViewProps } from "./types";

const VIEWS = [
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "overdue", label: "Overdue" },
  { id: "all", label: "All open" },
  { id: "completed", label: "Completed" },
] as const;

export async function TasksView({ repo, searchParams }: ViewProps) {
  const [tasks, prospects, options] = await Promise.all([repo.listTasks(), repo.listActiveProspects(), repo.listProspectOptions()]);
  const t = repo.todayIso;
  const h = (p: string) => `${repo.basePath}${p}`;
  const view = (sp(searchParams, "view") ?? "today") as (typeof VIEWS)[number]["id"];
  const priority = sp(searchParams, "priority");
  const a = dailyAttention(tasks, prospects, t);
  const open = tasks.filter((x) => x.status === "open");

  let list: Task[];
  switch (view) {
    case "upcoming": list = open.filter((x) => x.due_date > t); break;
    case "overdue": list = a.overdue; break;
    case "all": list = open; break;
    case "completed": list = tasks.filter((x) => x.status === "completed").sort((x, y) => (y.completed_at ?? "").localeCompare(x.completed_at ?? "")).slice(0, 100); break;
    default: list = [...a.overdue, ...a.dueToday];
  }
  if (priority) list = list.filter((x) => x.priority === priority);

  // Group upcoming by date for scanability
  const groups = new Map<string, Task[]>();
  if (view === "upcoming" || view === "all") for (const x of list) groups.set(x.due_date, [...(groups.get(x.due_date) ?? []), x]);

  const qs = (k: string, v?: string) => {
    const u = new URLSearchParams({ view, ...(priority ? { priority } : {}) });
    if (v) u.set(k, v); else u.delete(k);
    return h(`/tasks?${u.toString()}`);
  };

  return (
    <>
      <PageHeader title="Tasks" description="Your follow-ups, including tasks generated automatically from renewal schedules." actions={<NewTaskDialog prospects={options} defaultDate={t} />} />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Task summary">
        <KpiCard label="Due today" value={String(a.dueToday.length)} icon={<Sun />} href={qs("view", "today")} />
        <KpiCard label="Overdue" value={String(a.overdue.length)} icon={<AlertCircle />} href={qs("view", "overdue")} accent="slate" />
        <KpiCard label="Next 7 days" value={String(a.upcoming.length)} icon={<CalendarDays />} href={qs("view", "upcoming")} accent="teal" />
        <KpiCard label="Completed (all time)" value={String(tasks.length - open.length)} icon={<CheckCircle2 />} href={qs("view", "completed")} accent="green" />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Task views">
              {VIEWS.map((v) => (
                <Link key={v.id} role="tab" aria-selected={view === v.id} href={qs("view", v.id)} scroll={false}
                  className={cn("rounded-md px-3 py-1 text-sm font-medium text-muted-foreground transition-colors", view === v.id && "bg-card text-foreground shadow-sm")}
                >
                  {v.label}
                </Link>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Priority:</span>
              {[undefined, "high", "medium", "low"].map((p) => (
                <Link key={p ?? "any"} href={qs("priority", p)} scroll={false} className={cn("rounded-full border px-2.5 py-0.5", priority === p ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")}>
                  {p ? p[0].toUpperCase() + p.slice(1) : "Any"}
                </Link>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {groups.size ? (
              <div className="grid gap-4">
                {[...groups].map(([date, ts]) => (
                  <div key={date}>
                    <h3 className={cn("mb-1 text-xs font-semibold uppercase tracking-wide", date < t ? "text-destructive" : "text-muted-foreground")}>
                      {date === t ? "Today" : date === addDays(t, 1) ? "Tomorrow" : formatDate(date, { weekday: "short", month: "short", day: "numeric" })}
                    </h3>
                    <TaskList tasks={ts} todayIso={t} />
                  </div>
                ))}
              </div>
            ) : (
              <TaskList tasks={list} todayIso={t} emptyText={view === "today" ? "Nothing due today — check Upcoming or pick prospects from the attention list." : "No tasks here."} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ListTodo className="size-4 text-primary" /> Needs attention today</CardTitle>
            <CardDescription>Businesses with follow-ups due or renewal outreach overdue</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Follow-up date reached ({a.followUpsDue.length})</h4>
              <ul className="divide-y">
                {a.followUpsDue.slice(0, 8).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <Link href={h(`/prospects/${p.id}`)} className="truncate font-medium hover:text-primary">{p.business_name}</Link>
                    <span className="text-xs text-muted-foreground tabular">{formatDate(p.next_follow_up_date, { month: "short", day: "numeric" })}</span>
                  </li>
                ))}
                {a.followUpsDue.length === 0 && <li className="py-2 text-sm text-muted-foreground">None</li>}
              </ul>
            </div>
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Renewal outreach overdue ({a.renewalOutreachOverdue.length})</h4>
              <ul className="divide-y">
                {a.renewalOutreachOverdue.slice(0, 8).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <Link href={h(`/prospects/${p.id}`)} className="truncate font-medium hover:text-primary">{p.business_name}</Link>
                    <RenewalBadge date={p.renewal_date} status={p.renewal_date_status} todayIso={t} showDate={false} />
                  </li>
                ))}
                {a.renewalOutreachOverdue.length === 0 && <li className="py-2 text-sm text-muted-foreground">None</li>}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
