import Link from "next/link";
import { Archive, ChevronLeft, ChevronRight, Download, Plus, Upload, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { CoverageChips, DataSourceBadge, PageHeader, RenewalBadge, StageBadge, UnknownValue } from "@/components/app/bits";
import { ProspectFilters } from "@/components/app/prospect-filters";
import { DemoAwareLink } from "@/components/app/demo-link";
import { PAGE_SIZE, parseFilters } from "@/lib/domain/filters";
import { formatDate } from "@/lib/domain/dates";
import { formatCurrency } from "@/lib/utils";
import type { ViewProps } from "./types";

export async function ProspectsView({ repo, searchParams = {} }: ViewProps) {
  const f = parseFilters(searchParams);
  const { rows, total } = await repo.listProspects(f);
  const h = (p: string) => `${repo.basePath}${p}`;
  const page = f.page ?? 1;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (n: number) => {
    const u = new URLSearchParams(Object.entries(searchParams).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])));
    u.set("page", String(n));
    return `?${u.toString()}`;
  };

  return (
    <>
      <PageHeader
        title={f.archived ? "Archived prospects" : "Prospects"}
        description={`${total} ${f.archived ? "archived" : "active"} prospect${total === 1 ? "" : "s"}`}
        actions={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link href={f.archived ? h("/prospects") : h("/prospects?archived=1")}><Archive /> {f.archived ? "View active" : "Archived"}</Link>
            </Button>
            <DemoAwareLink href="/api/prospects/export" download className="inline-flex"><Download /> Export CSV</DemoAwareLink>
            <Button asChild variant="outline"><Link href={h("/prospects/import")}><Upload /> Import</Link></Button>
            <Button asChild><Link href={h("/prospects/new")}><Plus /> Add prospect</Link></Button>
          </>
        }
      />

      <Card>
        <div className="border-b p-3">
          <ProspectFilters show={["q", "industry", "state", "city", "renewalMonth", "stage", "sort"]} />
        </div>
        {rows.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title={total === 0 && !f.q && !f.industry ? "No prospects yet" : "No prospects match these filters"}
            description="Add prospects manually or import a CSV list to get started."
            action={<Button asChild size="sm"><Link href={h("/prospects/new")}><Plus /> Add prospect</Link></Button>}
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Business</TH>
                    <TH>Location</TH>
                    <TH>Renewal</TH>
                    <TH className="text-right">Est. premium</TH>
                    <TH>Coverage</TH>
                    <TH>Stage</TH>
                    <TH>Last contact</TH>
                  </TR>
                </THead>
                <TBody>
                  {rows.map((p) => (
                    <TR key={p.id}>
                      <TD className="max-w-[260px]">
                        <Link href={h(`/prospects/${p.id}`)} className="block truncate font-medium hover:text-primary">{p.business_name}</Link>
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          {p.industry ?? "Industry unknown"} {p.data_source !== "user_entered" && <DataSourceBadge source={p.data_source} />}
                        </span>
                      </TD>
                      <TD className="whitespace-nowrap text-sm">{[p.city, p.state].filter(Boolean).join(", ") || <UnknownValue />}</TD>
                      <TD className="whitespace-nowrap"><RenewalBadge date={p.renewal_date} status={p.renewal_date_status} todayIso={repo.todayIso} /></TD>
                      <TD className="text-right font-medium tabular">{p.estimated_premium !== null ? formatCurrency(p.estimated_premium) : <UnknownValue />}</TD>
                      <TD><CoverageChips lines={p.coverage_lines} max={3} /></TD>
                      <TD><StageBadge stage={p.pipeline_stage} /></TD>
                      <TD className="whitespace-nowrap text-sm text-muted-foreground tabular">{p.last_contacted_at ? formatDate(p.last_contacted_at, { month: "short", day: "numeric" }) : "Never"}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
            {/* Mobile cards */}
            <ul className="divide-y md:hidden">
              {rows.map((p) => (
                <li key={p.id}>
                  <Link href={h(`/prospects/${p.id}`)} className="block space-y-1.5 p-4 hover:bg-muted/50">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{p.business_name}</p>
                      <p className="font-semibold tabular">{formatCurrency(p.estimated_premium, { compact: true })}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{p.industry ?? "Industry unknown"} · {[p.city, p.state].filter(Boolean).join(", ") || "Location unknown"}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <StageBadge stage={p.pipeline_stage} />
                      <RenewalBadge date={p.renewal_date} status={p.renewal_date_status} todayIso={repo.todayIso} showDate={false} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            {pages > 1 && (
              <nav className="flex items-center justify-between border-t p-3 text-sm" aria-label="Pagination">
                <span className="text-muted-foreground">Page {page} of {pages}</span>
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm" className={page <= 1 ? "pointer-events-none opacity-50" : ""}><Link href={qs(page - 1)} aria-disabled={page <= 1}><ChevronLeft /> Prev</Link></Button>
                  <Button asChild variant="outline" size="sm" className={page >= pages ? "pointer-events-none opacity-50" : ""}><Link href={qs(page + 1)} aria-disabled={page >= pages}>Next <ChevronRight /></Link></Button>
                </div>
              </nav>
            )}
          </>
        )}
      </Card>
    </>
  );
}
