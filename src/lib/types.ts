export const PIPELINE_STAGES = [
  { id: "new_prospect", label: "New Prospect" },
  { id: "researching", label: "Researching" },
  { id: "contacted", label: "Contacted" },
  { id: "meeting_scheduled", label: "Meeting Scheduled" },
  { id: "discovery_completed", label: "Discovery Completed" },
  { id: "quoting", label: "Quoting" },
  { id: "proposal_presented", label: "Proposal Presented" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number]["id"];
export const STAGE_IDS = PIPELINE_STAGES.map((s) => s.id) as [PipelineStage, ...PipelineStage[]];
export const OPEN_STAGES = STAGE_IDS.filter((s) => s !== "won" && s !== "lost");
export const stageLabel = (s: PipelineStage) => PIPELINE_STAGES.find((x) => x.id === s)?.label ?? s;

export const COVERAGE_LINES = [
  { id: "general_liability", label: "General Liability", short: "GL" },
  { id: "commercial_property", label: "Commercial Property", short: "Property" },
  { id: "workers_comp", label: "Workers' Compensation", short: "WC" },
  { id: "commercial_auto", label: "Commercial Auto", short: "Auto" },
  { id: "umbrella", label: "Umbrella / Excess Liability", short: "Umbrella" },
  { id: "professional_liability", label: "Professional Liability", short: "E&O" },
  { id: "cyber", label: "Cyber Liability", short: "Cyber" },
  { id: "other", label: "Other Commercial Lines", short: "Other" },
] as const;
export type CoverageLine = (typeof COVERAGE_LINES)[number]["id"];
export const COVERAGE_IDS = COVERAGE_LINES.map((c) => c.id) as [CoverageLine, ...CoverageLine[]];
export const coverageLabel = (c: string) => COVERAGE_LINES.find((x) => x.id === c)?.label ?? c;
export const coverageShort = (c: string) => COVERAGE_LINES.find((x) => x.id === c)?.short ?? c;

export const INDUSTRIES = [
  "Construction",
  "Manufacturing",
  "Transportation",
  "Hospitality",
  "Real Estate",
  "Professional Services",
  "Healthcare",
  "Retail",
  "Technology",
  "Wholesale & Distribution",
  "Agriculture",
  "Nonprofit",
  "Other",
] as const;

export type RenewalDateStatus = "known" | "estimated" | "unknown";
export type DataSource = "user_entered" | "csv_import" | "verified_provider";
export type ActivityType = "call" | "email" | "meeting" | "note" | "stage_change" | "system";
export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "open" | "completed";
export type PlanTier = "trial" | "starter" | "pro";

export interface Prospect {
  id: string;
  business_name: string;
  industry: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  employee_count: number | null;
  annual_revenue: number | null;
  contact_name: string | null;
  contact_title: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  current_carrier: string | null;
  current_agency: string | null;
  renewal_date: string | null; // ISO date (YYYY-MM-DD)
  renewal_date_status: RenewalDateStatus;
  estimated_premium: number | null;
  coverage_lines: CoverageLine[];
  notes: string | null;
  lead_source: string | null;
  data_source: DataSource;
  last_contacted_at: string | null;
  next_follow_up_date: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  prospect_id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
}

export interface Opportunity {
  id: string;
  prospect_id: string;
  name: string;
  stage: PipelineStage;
  estimated_premium: number | null;
  close_probability: number;
  coverage_lines: CoverageLine[];
  expected_close_date: string | null;
  stage_changed_at: string;
  won_at: string | null;
  lost_at: string | null;
  lost_reason: string | null;
  created_at: string;
}

export interface OpportunityWithProspect extends Opportunity {
  prospect: Pick<Prospect, "id" | "business_name" | "industry" | "city" | "state" | "renewal_date" | "renewal_date_status">;
}

export interface Activity {
  id: string;
  prospect_id: string;
  opportunity_id: string | null;
  type: ActivityType;
  subject: string;
  body: string | null;
  occurred_at: string;
  prospect?: { business_name: string } | null;
}

export interface Task {
  id: string;
  prospect_id: string | null;
  title: string;
  description: string | null;
  due_date: string;
  priority: TaskPriority;
  status: TaskStatus;
  completed_at: string | null;
  source: "manual" | "renewal";
  renewal_cycle_date: string | null;
  renewal_offset_days: number | null;
  created_at: string;
  prospect?: { business_name: string } | null;
}

export interface UserSettings {
  agency_commission_rate: number;
  new_business_split: number;
  renewal_split: number;
  renewal_offsets: number[];
  auto_renewal_tasks: boolean;
}

export interface Subscription {
  plan: PlanTier;
  status: string;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export interface Profile {
  id: string;
  full_name: string | null;
  agency_name: string | null;
  email: string | null;
}

export interface AiGeneration {
  id: string;
  prospect_id: string | null;
  kind: string;
  tone: string | null;
  output: string;
  created_at: string;
}

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

export const DEFAULT_SETTINGS: UserSettings = {
  agency_commission_rate: 15,
  new_business_split: 40,
  renewal_split: 25,
  renewal_offsets: [120, 90, 60, 30],
  auto_renewal_tasks: true,
};
