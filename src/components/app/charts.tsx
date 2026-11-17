"use client";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/utils";
import { monthLabel } from "@/lib/domain/dates";

const axis = { stroke: "var(--muted-foreground)", fontSize: 11, tickLine: false, axisLine: false } as const;

type TipEntry = { dataKey?: unknown; name?: unknown; value?: unknown; color?: string; payload?: unknown };
type TipProps = { active?: boolean; payload?: ReadonlyArray<TipEntry>; label?: unknown; valueFormat: (v: number, key: string) => string; labelFormat?: (l: string) => string };

function TooltipBox({ active, payload, label, valueFormat, labelFormat }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-foreground">{labelFormat ? labelFormat(String(label)) : String(label ?? "")}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 rounded-sm" style={{ background: p.color ?? "var(--chart-1)" }} />
          {String(p.name ?? "")}: <span className="font-medium text-foreground tabular">{valueFormat(Number(p.value), String(p.dataKey))}</span>
        </p>
      ))}
    </div>
  );
}

/** Single-series bar: won premium per month. Commission shown in tooltip. */
export function MonthlyProductionChart({ data }: { data: { month: string; premium: number; commission: number; deals: number }[] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Monthly closed premium, last 12 months">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
          <XAxis dataKey="month" tickFormatter={(m) => monthLabel(m)} {...axis} interval="preserveStartEnd" minTickGap={8} />
          <YAxis tickFormatter={(v) => formatCurrency(v, { compact: true })} {...axis} width={56} />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
            content={(p) => (
              <TooltipBox
                active={p.active}
                label={p.label}
                labelFormat={(l) => monthLabel(l, "long")}
                valueFormat={(v) => formatCurrency(v)}
                payload={p.payload?.length ? [
                  ...(p.payload as ReadonlyArray<TipEntry>),
                  { dataKey: "commission", name: "Est. producer commission", value: (p.payload[0].payload as { commission: number }).commission, color: "var(--chart-2)" },
                ] : undefined}
              />
            )}
          />
          <Bar dataKey="premium" name="Closed premium" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal single-series bars for pipeline stages (count or value). */
export function StageBarChart({ data, valueKey, format }: { data: { label: string; count: number; premium: number; weightedPremium: number }[]; valueKey: "count" | "premium" | "weightedPremium"; format: "count" | "currency" }) {
  const fmt = (v: number) => (format === "currency" ? formatCurrency(v, { compact: true }) : String(v));
  return (
    <div className="w-full" style={{ height: Math.max(180, data.length * 34) }} role="img" aria-label={`Pipeline ${valueKey} by stage`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }} barCategoryGap={6}>
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis type="number" tickFormatter={fmt} {...axis} allowDecimals={false} />
          <YAxis type="category" dataKey="label" {...axis} width={128} />
          <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.6 }} content={(p) => <TooltipBox active={p.active} label={p.label} payload={p.payload as ReadonlyArray<TipEntry> | undefined} valueFormat={(v) => (format === "currency" ? formatCurrency(v) : String(v))} />} />
          <Bar dataKey={valueKey} name={valueKey === "count" ? "Opportunities" : valueKey === "premium" ? "Est. premium" : "Probability-weighted premium"} radius={[0, 4, 4, 0]} maxBarSize={22}>
            {data.map((d) => (
              <Cell key={d.label} fill={d.label === "Won" ? "var(--chart-2)" : d.label === "Lost" ? "var(--muted-foreground)" : "var(--chart-1)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
