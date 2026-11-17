import Link from "next/link";
import { CheckCircle2, Clock, Plug, Telescope, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { CoverageChips, DataLegend, DataSourceBadge, PageHeader, RenewalBadge, StageBadge, UnknownValue } from "@/components/app/bits";
import { ProspectFilters } from "@/components/app/prospect-filters";
import { AddToPipelineButton } from "@/components/app/crm-forms";
import { NICHES, parseFilters } from "@/lib/domain/filters";
import { listProviders } from "@/lib/providers";
import { coverageLabel } from "@/lib/types";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { ViewProps } from "./types";

export async function FinderView({ repo, searchParams = {} }: ViewProps) {
  const f = parseFilters(searchParams);
  const { rows, total } = await repo.listProspects({ ...f, sort: f.sort === "created_desc" ? "premium_desc" : f.sort });
  const niche = NICHES.find((n) => n.id === f.niche);
  const providers = listProviders();
  const h = (p: string) => `${repo.basePath}${p}`;

  return (
    <>
      <PageHeader
        title="Prospect Finder"
        description="Search and organize businesses from your manual entries and imported lists by industry, location, size and target niche."
        actions={<Button asChild variant="outline"><Link href={h("/prospects/import")}><Upload /> Import a business list</Link></Button>}
      />

      <Card>
        <div className="grid gap-3 border-b p-3">
          <ProspectFilters show={["niche", "industry", "city", "state", "zip", "size", "stage", "sort"]} />
          {niche && (
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">{niche.label}</strong> targets {niche.industries.join(", ")} · key lines: {niche.lines.map(coverageLabel).join(", ")}
            </p>
          )}
          <DataLegend />
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={<Telescope />} title="No businesses match" description="Try broadening your filters, or import a CSV business list you're licensed to use." />
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Business</TH><TH>Location</TH><TH className="text-right">Employees</TH><TH className="text-right">Est. premium</TH><TH>Coverage</TH><TH>Renewal</TH><TH>Source</TH><TH>Pipeline</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((p) => (
                <TR key={p.id}>
                  <TD className="max-w-[240px]">
                    <Link href={h(`/prospects/${p.id}`)} className="block truncate font-medium hover:text-primary">{p.business_name}</Link>
                    <span className="text-xs text-muted-foreground">{p.industry ?? "Industry unknown"}</span>
                  </TD>
                  <TD className="whitespace-nowrap text-sm">{[p.city, p.state, p.zip].filter(Boolean).join(", ") || <UnknownValue />}</TD>
                  <TD className="text-right tabular">{p.employee_count !== null ? formatNumber(p.employee_count) : <UnknownValue />}</TD>
                  <TD className="text-right tabular">{p.estimated_premium !== null ? formatCurrency(p.estimated_premium) : <UnknownValue />}</TD>
                  <TD><CoverageChips lines={p.coverage_lines} max={3} /></TD>
                  <TD className="whitespace-nowrap"><RenewalBadge date={p.renewal_date} status={p.renewal_date_status} todayIso={repo.todayIso} showDate={false} /></TD>
                  <TD><DataSourceBadge source={p.data_source} /></TD>
                  <TD>{p.pipeline_stage ? <StageBadge stage={p.pipeline_stage} /> : <AddToPipelineButton prospectId={p.id} size="sm" />}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">{total} result{total === 1 ? "" : "s"} · sorted by premium opportunity</p>
      </Card>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plug className="size-4 text-primary" /> Data sources</CardTitle>
          <CardDescription>ProducerOS only uses data you enter, files you upload, or properly licensed providers. We never scrape restricted sites or fabricate businesses.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((p) => (
            <div key={p.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{p.name}</p>
                {p.status === "active" ? <Badge variant="success"><CheckCircle2 /> Active</Badge> : p.status === "not_configured" ? <Badge variant="warning">Not configured</Badge> : <Badge variant="muted"><Clock /> Planned</Badge>}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
