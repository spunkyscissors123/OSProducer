"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppMode } from "./mode";
import { cn, formatCurrency } from "@/lib/utils";
import { diffDays } from "@/lib/domain/dates";

interface Item {
  id: string;
  business_name: string;
  renewal_date: string;
  renewal_date_status: "known" | "estimated" | "unknown";
  estimated_premium: number | null;
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function RenewalCalendar({ items, todayIso }: { items: Item[]; todayIso: string }) {
  const { href } = useAppMode();
  const [cursor, setCursor] = useState(() => ({ y: Number(todayIso.slice(0, 4)), m: Number(todayIso.slice(5, 7)) - 1 }));
  const monthKey = `${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}`;
  const byDay = useMemo(() => {
    const map = new Map<number, Item[]>();
    for (const i of items) if (i.renewal_date.startsWith(monthKey)) {
      const d = Number(i.renewal_date.slice(8, 10));
      map.set(d, [...(map.get(d) ?? []), i]);
    }
    return map;
  }, [items, monthKey]);

  const first = new Date(Date.UTC(cursor.y, cursor.m, 1)).getUTCDay();
  const days = new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const shift = (n: number) => setCursor(({ y, m }) => ({ y: m + n < 0 ? y - 1 : m + n > 11 ? y + 1 : y, m: (m + n + 12) % 12 }));
  const label = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(cursor.y, cursor.m, 1)));
  const monthTotal = [...byDay.values()].flat();

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-lg font-bold">{label}</h3>
          <p className="text-xs text-muted-foreground">{monthTotal.length} renewal{monthTotal.length === 1 ? "" : "s"} · {formatCurrency(monthTotal.reduce((s, i) => s + (i.estimated_premium ?? 0), 0), { compact: true })} est. premium</p>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="icon-sm" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft /></Button>
          <Button variant="outline" size="sm" onClick={() => setCursor({ y: Number(todayIso.slice(0, 4)), m: Number(todayIso.slice(5, 7)) - 1 })}>Today</Button>
          <Button variant="outline" size="icon-sm" onClick={() => shift(1)} aria-label="Next month"><ChevronRight /></Button>
        </div>
      </div>

      {/* Grid for sm+ */}
      <div className="hidden overflow-hidden rounded-lg border sm:block">
        <div className="grid grid-cols-7 border-b bg-muted/50 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {DOW.map((d) => <div key={d} className="py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            const iso = d ? `${monthKey}-${String(d).padStart(2, "0")}` : "";
            const list = d ? byDay.get(d) ?? [] : [];
            return (
              <div key={i} className={cn("min-h-24 border-b border-r p-1.5 text-xs [&:nth-child(7n)]:border-r-0", !d && "bg-muted/30")}>
                {d && (
                  <>
                    <span className={cn("inline-flex size-6 items-center justify-center rounded-full tabular", iso === todayIso && "bg-primary font-semibold text-white")}>{d}</span>
                    <ul className="mt-1 grid gap-1">
                      {list.slice(0, 3).map((it) => (
                        <li key={it.id}>
                          <Link
                            href={href(`/prospects/${it.id}`)}
                            title={`${it.business_name}${it.renewal_date_status === "estimated" ? " (estimated date)" : ""}`}
                            className={cn(
                              "block truncate rounded px-1.5 py-0.5 font-medium",
                              it.renewal_date_status === "estimated" ? "border border-dashed border-warning/60 bg-warning/10 text-warning" : "bg-primary/10 text-primary",
                            )}
                          >
                            {it.business_name}
                          </Link>
                        </li>
                      ))}
                      {list.length > 3 && <li className="px-1 text-muted-foreground">+{list.length - 3} more</li>}
                    </ul>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Agenda list on mobile */}
      <ul className="divide-y rounded-lg border sm:hidden">
        {monthTotal.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">No renewals this month.</li>}
        {monthTotal.sort((a, b) => a.renewal_date.localeCompare(b.renewal_date)).map((it) => (
          <li key={it.id}>
            <Link href={href(`/prospects/${it.id}`)} className="flex items-center justify-between gap-3 p-3">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{it.business_name}</span>
                <span className="text-xs text-muted-foreground">{it.renewal_date}{it.renewal_date_status === "estimated" ? " · estimate" : ""}</span>
              </span>
              <span className="text-xs text-muted-foreground tabular">{diffDays(todayIso, it.renewal_date)}d</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm bg-primary/30" /> Confirmed date</span>
        <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm border border-dashed border-warning bg-warning/10" /> Estimated date</span>
      </p>
    </div>
  );
}
