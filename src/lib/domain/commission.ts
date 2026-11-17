/**
 * Commission & production estimates. All outputs are ESTIMATES; formulas are exported
 * as human-readable strings so the UI can show exactly how each number was derived.
 */
export interface CommissionInputs {
  annualPremium: number;
  agencyCommissionRate: number; // percent, e.g. 15
  newBusinessSplit: number; // percent of agency commission paid to producer in year 1
  renewalSplit: number; // percent of agency commission paid to producer on renewals
  closeProbability: number; // percent
  retentionYears?: number; // renewal years to project (default 1)
}

export interface CommissionResult {
  agencyCommission: number;
  producerNewBusiness: number;
  producerRenewal: number;
  weightedPremium: number;
  weightedProducerNewBusiness: number;
  projectedAnnualProduction: number;
  formulas: Record<string, string>;
}

const pct = (n: number) => clamp(n, 0, 100) / 100;
export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(n) ? n : 0));
export const round2 = (n: number) => Math.round(n * 100) / 100;

export function calculateCommission(i: CommissionInputs): CommissionResult {
  const premium = Math.max(0, i.annualPremium || 0);
  const agencyCommission = premium * pct(i.agencyCommissionRate);
  const producerNewBusiness = agencyCommission * pct(i.newBusinessSplit);
  const producerRenewal = agencyCommission * pct(i.renewalSplit);
  const p = pct(i.closeProbability);
  const years = Math.max(0, Math.floor(i.retentionYears ?? 1));
  return {
    agencyCommission: round2(agencyCommission),
    producerNewBusiness: round2(producerNewBusiness),
    producerRenewal: round2(producerRenewal),
    weightedPremium: round2(premium * p),
    weightedProducerNewBusiness: round2(producerNewBusiness * p),
    projectedAnnualProduction: round2((producerNewBusiness + producerRenewal * years) * p),
    formulas: {
      agencyCommission: "Annual premium × agency commission rate",
      producerNewBusiness: "Agency commission × producer new-business split",
      producerRenewal: "Agency commission × producer renewal split (per renewal year)",
      weightedPremium: "Annual premium × close probability",
      weightedProducerNewBusiness: "Producer new-business commission × close probability",
      projectedAnnualProduction: `(Producer new-business + producer renewal × ${years} yr) × close probability`,
    },
  };
}

/** Producer's estimated new-business commission on a premium using account defaults. */
export function producerCommission(premium: number | null | undefined, rate: number, split: number): number {
  return round2(Math.max(0, premium ?? 0) * pct(rate) * pct(split));
}
