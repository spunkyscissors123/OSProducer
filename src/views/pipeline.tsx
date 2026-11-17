import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/primitives";
import { EstimateNote, KpiCard, PageHeader } from "@/components/app/bits";
import { PipelineBoard } from "@/components/app/pipeline-board";
import { StageBarChart } from "@/components/app/charts";
import { funnelConversion, stageStats, winRate } from "@/lib/domain/pipeline";
import { producerCommission } from "@/lib/domain/commission";
import { OPEN_STAGES } from "@/lib/types";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { BarChart3, DollarSign, Percent, Target } from "lucide-react";
import type { ViewProps } from "./types";

export async function PipelineView({ repo }: ViewProps) {
  const [opps, settings] = await Promise.all([repo.listOpportunities(), repo.getSettings()]);
  const rate = settings.agency_commission_rate;
  const split = settings.new_business_split;
  const stats = stageStats(opps, rate, split);
  const open = stats.filter((s) => (OPEN_STAGES as string[]).includes(s.stage));
  const openPremium = open.reduce((s, x) => s + x.premium, 0);
  const weighted = open.reduce((s, x) => s + x.weightedPremium, 0);
  const funnel = funnelConversion(opps);
  const wr = winRate(opps);

  return (
    <>
      <PageHeader
        title="Sales pipeline"
        description="Drag opportunities between stages, or use the move menu on each card. Every change is saved."
        actions={<Button asChild><Link href={`${repo.basePath}/prospects/new`}><Plus /> New prospect</Link></Button>}
      />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Pipeline summary">
        <KpiCard label="Open opportunities" value={String(open.reduce((s, x) => s + x.count, 0))} icon={<Target />} />
        <KpiCard label="Open premium (est.)" value={formatCurrency(openPremium, { compact: true })} sub={`${formatCurrency(producerCommission(openPremium, rate, split), { compact: true })} est. commission`} icon={<DollarSign />} accent="teal" />
        <KpiCard label="Probability-weighted" value={formatCurrency(weighted, { compact: true })} sub={`${formatCurrency(producerCommission(weighted, rate, split), { compact: true })} weighted commission`} icon={<BarChart3 />} accent="slate" />
        <KpiCard label="Win rate" value={wr === null ? "—" : formatPercent(wr)} sub="Won ÷ (won + lost)" icon={<Percent />} accent="green" />
      </section>

      <PipelineBoard opportunities={opps} rate={rate} split={split} todayIso={repo.todayIso} />

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Opportunities by stage</CardTitle>
            <CardDescription>Estimated premium per stage</CardDescription>
          </CardHeader>
          <CardContent>
            <StageBarChart data={stats} valueKey="premium" format="currency" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Stage conversion</CardTitle>
            <CardDescription>Share of all opportunities that reached each stage</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <caption className="sr-only">Stage conversion rates</caption>
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 font-semibold">Stage</th><th className="pb-2 text-right font-semibold">Reached</th><th className="w-2/5 pb-2 pl-4 font-semibold">Rate</th>
                </tr>
              </thead>
              <tbody>
                {funnel.map((f) => (
                  <tr key={f.stage} className="border-t">
                    <td className="py-2">{f.label}</td>
                    <td className="py-2 text-right tabular">{f.reached}</td>
                    <td className="py-2 pl-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-primary" style={{ width: `${f.rate * 100}%` }} /></div>
                        <span className="w-10 text-right text-xs tabular">{formatPercent(f.rate)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <EstimateNote className="mt-3" />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
