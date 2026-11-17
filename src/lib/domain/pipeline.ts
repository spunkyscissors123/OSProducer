import { PIPELINE_STAGES, type Opportunity, type PipelineStage } from "../types";
import { producerCommission, round2 } from "./commission";

export interface StageStat {
  stage: PipelineStage;
  label: string;
  count: number;
  premium: number;
  weightedPremium: number;
  commission: number;
}

export function stageStats(opps: Opportunity[], rate: number, split: number): StageStat[] {
  return PIPELINE_STAGES.map(({ id, label }) => {
    const inStage = opps.filter((o) => o.stage === id);
    const premium = inStage.reduce((s, o) => s + (o.estimated_premium ?? 0), 0);
    const weighted = inStage.reduce((s, o) => s + (o.estimated_premium ?? 0) * (o.close_probability / 100), 0);
    return {
      stage: id,
      label,
      count: inStage.length,
      premium: round2(premium),
      weightedPremium: round2(weighted),
      commission: producerCommission(premium, rate, split),
    };
  });
}

const STAGE_ORDER: Record<PipelineStage, number> = Object.fromEntries(PIPELINE_STAGES.map((s, i) => [s.id, i])) as Record<PipelineStage, number>;

/**
 * Funnel conversion: share of opportunities that reached at least each stage.
 * Lost opportunities count as having reached the furthest stage recorded before loss is unknown,
 * so they count only toward "New Prospect". Won counts as reaching every stage.
 */
export function funnelConversion(opps: Opportunity[]): { stage: PipelineStage; label: string; reached: number; rate: number }[] {
  const total = opps.length;
  const funnel = PIPELINE_STAGES.filter((s) => s.id !== "lost");
  return funnel.map(({ id, label }) => {
    const idx = STAGE_ORDER[id];
    const reached = opps.filter((o) => (o.stage === "lost" ? idx === 0 : STAGE_ORDER[o.stage] >= idx)).length;
    return { stage: id, label, reached, rate: total ? reached / total : 0 };
  });
}

/** Win rate among closed (won + lost) opportunities. */
export function winRate(opps: Opportunity[]): number | null {
  const won = opps.filter((o) => o.stage === "won").length;
  const lost = opps.filter((o) => o.stage === "lost").length;
  return won + lost ? won / (won + lost) : null;
}

/** Default close probability suggested for a stage (user can override per opportunity). */
export const STAGE_DEFAULT_PROBABILITY: Record<PipelineStage, number> = {
  new_prospect: 5,
  researching: 10,
  contacted: 15,
  meeting_scheduled: 25,
  discovery_completed: 40,
  quoting: 55,
  proposal_presented: 70,
  won: 100,
  lost: 0,
};
