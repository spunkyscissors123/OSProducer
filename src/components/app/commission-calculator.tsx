"use client";
import { useState } from "react";
import { Calculator, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input } from "@/components/ui/primitives";
import { calculateCommission } from "@/lib/domain/commission";
import { formatCurrency } from "@/lib/utils";
import type { UserSettings } from "@/lib/types";

export function CommissionCalculator({ settings }: { settings: UserSettings }) {
  const [v, setV] = useState({
    annualPremium: 100000,
    agencyCommissionRate: settings.agency_commission_rate,
    newBusinessSplit: settings.new_business_split,
    renewalSplit: settings.renewal_split,
    closeProbability: 50,
    retentionYears: 1,
  });
  const r = calculateCommission(v);
  const num = (k: keyof typeof v, label: string, suffix: string, max?: number, step = 1) => (
    <Field label={label} htmlFor={`calc-${k}`}>
      <div className="relative">
        <Input id={`calc-${k}`} type="number" inputMode="decimal" min={0} max={max} step={step} value={v[k]} onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })} className="pr-10 tabular" />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>
      </div>
    </Field>
  );
  const rows: [string, number, string][] = [
    ["Estimated agency commission", r.agencyCommission, r.formulas.agencyCommission],
    ["Estimated producer new-business commission", r.producerNewBusiness, r.formulas.producerNewBusiness],
    ["Estimated producer renewal commission (per year)", r.producerRenewal, r.formulas.producerRenewal],
    ["Probability-weighted premium", r.weightedPremium, r.formulas.weightedPremium],
    ["Probability-weighted producer commission", r.weightedProducerNewBusiness, r.formulas.weightedProducerNewBusiness],
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Calculator className="size-4 text-primary" /> Commission & production calculator</CardTitle>
        <CardDescription>Defaults come from your Settings. Change any input to model a deal.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="grid content-start gap-3">
          {num("annualPremium", "Estimated annual premium", "$", undefined, 1000)}
          {num("agencyCommissionRate", "Average agency commission rate", "%", 100, 0.5)}
          {num("newBusinessSplit", "Producer new-business split", "%", 100)}
          {num("renewalSplit", "Producer renewal split", "%", 100)}
          {num("closeProbability", "Expected close probability", "%", 100, 5)}
          {num("retentionYears", "Renewal years to project", "yrs", 10)}
        </div>
        <div className="grid content-start gap-3">
          <div className="rounded-xl bg-gradient-to-br from-primary to-teal p-5 text-white">
            <p className="text-xs font-medium uppercase tracking-wide text-white/80">Projected annual production (estimate)</p>
            <p className="mt-1 font-display text-3xl font-bold tabular">{formatCurrency(r.projectedAnnualProduction)}</p>
            <p className="mt-1 text-xs text-white/80">{r.formulas.projectedAnnualProduction}</p>
          </div>
          <dl className="divide-y rounded-xl border">
            {rows.map(([label, value, formula]) => (
              <div key={label} className="flex items-start justify-between gap-4 p-3">
                <div>
                  <dt className="text-sm font-medium">{label}</dt>
                  <dd className="text-xs text-muted-foreground">= {formula}</dd>
                </div>
                <dd className="text-right font-semibold tabular">{formatCurrency(value)}</dd>
              </div>
            ))}
          </dl>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" /> All results are estimates for planning only. Actual commissions depend on your agency agreement, carrier commission schedules, and final bound premium.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
