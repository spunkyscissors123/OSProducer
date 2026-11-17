import Link from "next/link";
import { AlertTriangle, CircleHelp, Database, FileSpreadsheet, PenLine, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { coverageLabel, coverageShort, stageLabel, type DataSource, type PipelineStage, type RenewalDateStatus, type TaskPriority } from "@/lib/types";
import { diffDays, formatDate, relativeDays } from "@/lib/domain/dates";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight sm:text-[26px]">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function KpiCard({ label, value, sub, icon, href, accent = "blue" }: { label: string; value: string; sub?: string; icon: React.ReactNode; href?: string; accent?: "blue" | "teal" | "slate" | "green" }) {
  const accents = {
    blue: "bg-primary/10 text-primary",
    teal: "bg-accent text-accent-foreground",
    slate: "bg-muted text-muted-foreground",
    green: "bg-success/12 text-success",
  };
  const body = (
    <div className="group flex h-full flex-col justify-between gap-3 rounded-xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-medium text-muted-foreground">{label}</span>
        <span className={cn("rounded-lg p-1.5 [&_svg]:size-4", accents[accent])}>{icon}</span>
      </div>
      <div>
        <p className="font-display text-2xl font-bold tracking-tight tabular">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href} className="block rounded-xl focus-visible:outline-2">{body}</Link> : body;
}

const STAGE_STYLE: Record<PipelineStage, string> = {
  new_prospect: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  researching: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300",
  contacted: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  meeting_scheduled: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  discovery_completed: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  quoting: "bg-teal-500/12 text-teal-700 dark:text-teal-300",
  proposal_presented: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  won: "bg-success/12 text-success",
  lost: "bg-destructive/10 text-destructive",
};
export function StageBadge({ stage }: { stage: PipelineStage | null }) {
  if (!stage) return <Badge variant="outline">Not in pipeline</Badge>;
  return <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", STAGE_STYLE[stage])}>{stageLabel(stage)}</span>;
}

/** Renewal date display that always distinguishes known / estimated / unknown. */
export function RenewalBadge({ date, status, todayIso, showDate = true }: { date: string | null; status: RenewalDateStatus; todayIso: string; showDate?: boolean }) {
  if (!date || status === "unknown") {
    return (
      <Badge variant="muted" title="Renewal date unknown — not estimated">
        <CircleHelp /> Unknown
      </Badge>
    );
  }
  const d = diffDays(todayIso, date);
  const variant = d < 0 ? "outline" : d <= 30 ? "danger" : d <= 60 ? "warning" : d <= 120 ? "default" : "muted";
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {showDate && <span className="tabular text-sm">{formatDate(date)}</span>}
      <Badge variant={variant} title={d < 0 ? "Renewal date has passed — confirm the new date" : undefined}>{d < 0 ? "Passed" : relativeDays(d)}</Badge>
      {status === "estimated" && (
        <Badge variant="warning" title="This renewal date is an estimate and has not been confirmed">
          <AlertTriangle /> Estimate
        </Badge>
      )}
    </span>
  );
}

export function DataSourceBadge({ source }: { source: DataSource }) {
  const map = {
    verified_provider: { label: "Verified", icon: ShieldCheck, variant: "success" as const, title: "From a licensed data provider" },
    user_entered: { label: "User-entered", icon: PenLine, variant: "outline" as const, title: "Entered manually by you" },
    csv_import: { label: "CSV import", icon: FileSpreadsheet, variant: "outline" as const, title: "Imported from your CSV file" },
  }[source];
  const Icon = map.icon;
  return (
    <Badge variant={map.variant} title={map.title}>
      <Icon /> {map.label}
    </Badge>
  );
}

export function UnknownValue({ children = "Unknown" }: { children?: React.ReactNode }) {
  return <span className="text-sm italic text-muted-foreground/80">{children}</span>;
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return <Badge variant={priority === "high" ? "danger" : priority === "medium" ? "warning" : "muted"}>{priority[0].toUpperCase() + priority.slice(1)}</Badge>;
}

export function CoverageChips({ lines, max = 4 }: { lines: string[]; max?: number }) {
  if (!lines.length) return <UnknownValue>Not specified</UnknownValue>;
  return (
    <span className="flex flex-wrap gap-1">
      {lines.slice(0, max).map((l) => (
        <Badge key={l} variant="teal" title={coverageLabel(l)}>{coverageShort(l)}</Badge>
      ))}
      {lines.length > max && <Badge variant="muted">+{lines.length - max}</Badge>}
    </span>
  );
}

export function DataLegend() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Database className="size-3.5" /> Data provenance:
      <DataSourceBadge source="verified_provider" />
      <DataSourceBadge source="user_entered" />
      <DataSourceBadge source="csv_import" />
      <Badge variant="muted"><CircleHelp /> Unknown</Badge>
    </div>
  );
}

export function EstimateNote({ className }: { className?: string }) {
  return <p className={cn("text-xs text-muted-foreground", className)}>All premium and commission figures are estimates based on your inputs and commission settings — not guarantees of compensation.</p>;
}
