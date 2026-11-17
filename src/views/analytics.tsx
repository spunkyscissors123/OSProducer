import Link from "next/link";
import { DollarSign, Lock, Percent, Trophy, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { EstimateNote, KpiCard, PageHeader } from "@/components/app/bits";
import { MonthlyProductionChart, StageBarChart } from "@/components/app/charts";
import { CommissionCalculator } from "@/components/app/commission-calculator";
import { monthlyProduction } from "@/lib/domain/dashboard";
import { stageStats, winRate } from "@/lib/domain/pipeline";
import { producerCommission } from "@/lib/domain/commission";
import { hasFeature } from "@/lib/plans";
import { OPEN_STAGES } from "@/lib/types";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { ViewProps } from "./types";

function Locked({ feature, basePath }: { feature: string; basePath: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
        <Lock className="size-5 text-muted-foreground" />
        <p className="font-medium">{feature} is a Pro feature</p>
        <p className="max-w-sm text-sm text-muted-foreground">Upgrade to Pro for advanced reporting and commission forecasting.</p>
        <Button asChild size="sm" className="mt-1"><Link href={`${basePath}/billing`}>See plans</Link></Button>
      </CardContent>
    </Card>
  );
}

export async function AnalyticsView({ repo }: ViewProps) {
  const [opps, prospects, settings, ent] = await Promise.all([repo.listOpportunities(), repo.listActiveProspects(), repo.getSettings(), repo.getEntitlements()]);
  const t = repo.todayIso;
  const rate = settings.agency_commission_rate;
  const nb = settings.new_business_split;
  const production = monthlyProduction(opps, settings, t);
  const won = opps.filter((o) => o.stage === "won");
  const wonYtd = won.filter((o) => o.won_at?.startsWith(t.slice(0, 4)));
  const ytdPremium = wonYtd.reduce((s, o) => s + (o.estimated_premium ?? 0), 0);
  const open = opps.filter((o) => (OPEN_STAGES as string[]).includes(o.stage));
  const weighted = open.reduce((s, o) => s + (o.estimated_premium ?? 0) * (o.close_probability / 100), 0);
  const wr = winRate(opps);
  const avgDeal = won.length ? won.reduce((s, o) => s + (o.estimated_premium ?? 0), 0) / won.length : null;
  const stats = stageStats(opps, rate, nb);

  // By industry (advanced)
  const industries = new Map<string, { prospects: number; open: number; won: number; premium: number }>();
  for (const p of prospects) {
    const k = p.industry ?? "Unknown";
    const row = industries.get(k) ?? { prospects: 0, open: 0, won: 0, premium: 0 };
    row.prospects++;
    industries.set(k, row);
  }
  for (const o of opps) {
    const k = o.prospect.industry ?? "Unknown";
    const row = industries.get(k) ?? { prospects: 0, open: 0, won: 0, premium: 0 };
    if (o.stage === "won") { row.won++; row.premium += o.estimated_premium ?? 0; }
    else if (o.stage !== "lost") row.open++;
    industries.set(k, row);
  }
  const advanced = hasFeature(ent, "advanced_reporting");
  const forecasting = hasFeature(ent, "commission_forecasting");

  return (
    <>
      <PageHeader title="Production analytics" description="Closed business, pipeline health and commission forecasting." />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Closed premium YTD" value={formatCurrency(ytdPremium, { compact: true })} sub={`${wonYtd.length} accounts`} icon={<Trophy />} accent="green" />
        <KpiCard label="Est. producer commission YTD" value={formatCurrency(producerCommission(ytdPremium, rate, nb), { compact: true })} sub={`${rate}% × ${nb}% split`} icon={<DollarSign />} accent="teal" />
        <KpiCard label="Weighted pipeline" value={formatCurrency(weighted, { compact: true })} sub="Premium × close probability" icon={<TrendingUp />} />
        <KpiCard label="Win rate" value={wr === null ? "—" : formatPercent(wr)} sub={avgDeal ? `Avg. won premium ${formatCurrency(avgDeal, { compact: true })}` : "No closed deals yet"} icon={<Percent />} accent="slate" />
      </section>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Monthly production</CardTitle>
          <CardDescription>Closed premium by month (trailing 12 months)</CardDescription>
        </CardHeader>
        <CardContent>
          <MonthlyProductionChart data={production} />
          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-muted-foreground">View as table</summary>
            <Table className="mt-2">
              <THead><TR className="hover:bg-transparent"><TH>Month</TH><TH className="text-right">Deals</TH><TH className="text-right">Closed premium</TH><TH className="text-right">Est. commission</TH></TR></THead>
              <TBody>
                {production.map((m) => (
                  <TR key={m.month}><TD>{m.month}</TD><TD className="text-right tabular">{m.deals}</TD><TD className="text-right tabular">{formatCurrency(m.premium)}</TD><TD className="text-right tabular">{formatCurrency(m.commission)}</TD></TR>
                ))}
              </TBody>
            </Table>
          </details>
          <EstimateNote className="mt-2" />
        </CardContent>
      </Card>

      <div className="mt-5">
        {forecasting ? <CommissionCalculator settings={settings} /> : <Locked feature="Commission forecasting" basePath={repo.basePath} />}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {advanced ? (
          <>
            <Card>
              <CardHeader><CardTitle>Probability-weighted pipeline by stage</CardTitle><CardDescription>Estimated premium × close probability</CardDescription></CardHeader>
              <CardContent><StageBarChart data={stats.filter((s) => (OPEN_STAGES as string[]).includes(s.stage))} valueKey="weightedPremium" format="currency" /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Performance by industry</CardTitle><CardDescription>Where your book is growing</CardDescription></CardHeader>
              <CardContent>
                <Table>
                  <THead><TR className="hover:bg-transparent"><TH>Industry</TH><TH className="text-right">Prospects</TH><TH className="text-right">Open</TH><TH className="text-right">Won</TH><TH className="text-right">Won premium</TH></TR></THead>
                  <TBody>
                    {[...industries].sort((a, b) => b[1].premium - a[1].premium || b[1].prospects - a[1].prospects).map(([k, r]) => (
                      <TR key={k}><TD className="font-medium">{k}</TD><TD className="text-right tabular">{r.prospects}</TD><TD className="text-right tabular">{r.open}</TD><TD className="text-right tabular">{r.won}</TD><TD className="text-right tabular">{formatCurrency(r.premium, { compact: true })}</TD></TR>
                    ))}
                  </TBody>
                </Table>
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="lg:col-span-2"><Locked feature="Advanced reporting" basePath={repo.basePath} /></div>
        )}
      </div>
    </>
  );
}
