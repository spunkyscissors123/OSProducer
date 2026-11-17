"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { Input, NativeSelect } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { INDUSTRIES, PIPELINE_STAGES } from "@/lib/types";
import { NICHES, SIZE_BANDS } from "@/lib/domain/filters";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type FilterKey = "q" | "industry" | "state" | "city" | "zip" | "renewalMonth" | "stage" | "sort" | "size" | "niche" | "archived";

/** URL-driven filters: shareable, back-button friendly, server-rendered results. */
export function ProspectFilters({ show, className }: { show: FilterKey[]; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== q) set("q", q.trim());
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const v = (k: string) => params.get(k) ?? "";
  const active = show.filter((k) => k !== "sort" && params.get(k)).length;

  return (
    <div className={cn("grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center", pending && "opacity-70", className)} aria-busy={pending}>
      {show.includes("q") && (
        <div className="relative sm:col-span-2 lg:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, contact, city" className="pl-9" aria-label="Search" />
        </div>
      )}
      {show.includes("niche") && (
        <NativeSelect value={v("niche")} onChange={(e) => set("niche", e.target.value)} aria-label="Target niche" className="lg:w-52">
          <option value="">All niches</option>
          {NICHES.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
        </NativeSelect>
      )}
      {show.includes("industry") && (
        <NativeSelect value={v("industry")} onChange={(e) => set("industry", e.target.value)} aria-label="Industry" className="lg:w-44">
          <option value="">All industries</option>
          {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
        </NativeSelect>
      )}
      {show.includes("state") && (
        <Input defaultValue={v("state")} onBlur={(e) => set("state", e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && set("state", e.currentTarget.value.toUpperCase())} placeholder="State" maxLength={2} aria-label="State" className="uppercase lg:w-20" />
      )}
      {show.includes("city") && (
        <Input defaultValue={v("city")} onBlur={(e) => set("city", e.target.value)} onKeyDown={(e) => e.key === "Enter" && set("city", e.currentTarget.value)} placeholder="City" aria-label="City" className="lg:w-32" />
      )}
      {show.includes("zip") && (
        <Input defaultValue={v("zip")} onBlur={(e) => set("zip", e.target.value)} onKeyDown={(e) => e.key === "Enter" && set("zip", e.currentTarget.value)} placeholder="ZIP" inputMode="numeric" maxLength={10} aria-label="ZIP code" className="lg:w-24" />
      )}
      {show.includes("size") && (
        <NativeSelect value={v("size")} onChange={(e) => set("size", e.target.value)} aria-label="Business size" className="lg:w-44">
          <option value="">Any size</option>
          {SIZE_BANDS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </NativeSelect>
      )}
      {show.includes("renewalMonth") && (
        <NativeSelect value={v("renewalMonth")} onChange={(e) => set("renewalMonth", e.target.value)} aria-label="Renewal month" className="lg:w-40">
          <option value="">Any renewal month</option>
          {MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>Renews in {m}</option>)}
        </NativeSelect>
      )}
      {show.includes("stage") && (
        <NativeSelect value={v("stage")} onChange={(e) => set("stage", e.target.value)} aria-label="Pipeline stage" className="lg:w-44">
          <option value="">Any stage</option>
          <option value="none">Not in pipeline</option>
          {PIPELINE_STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </NativeSelect>
      )}
      {show.includes("sort") && (
        <NativeSelect value={v("sort") || "created_desc"} onChange={(e) => set("sort", e.target.value)} aria-label="Sort" className="lg:w-48">
          <option value="created_desc">Newest first</option>
          <option value="premium_desc">Premium opportunity ↓</option>
          <option value="premium_asc">Premium opportunity ↑</option>
          <option value="renewal_asc">Renewal date (soonest)</option>
          <option value="name_asc">Name A–Z</option>
        </NativeSelect>
      )}
      {active > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("");
            startTransition(() => router.replace(pathname, { scroll: false }));
          }}
        >
          <X /> Clear ({active})
        </Button>
      )}
    </div>
  );
}
