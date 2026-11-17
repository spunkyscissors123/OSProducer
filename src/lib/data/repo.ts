import type { Activity, AiGeneration, Contact, Opportunity, OpportunityWithProspect, PipelineStage, Profile, Prospect, Task, UserSettings } from "../types";
import type { Entitlements } from "../plans";
import type { ProspectFilters } from "../domain/filters";

export interface ProspectRow extends Prospect {
  pipeline_stage: PipelineStage | null;
  opportunity_id: string | null;
}

export interface ProspectDetail {
  prospect: Prospect;
  contacts: Contact[];
  opportunities: Opportunity[];
  activities: Activity[];
  tasks: Task[];
}

/** Read-only data access used by pages. Live = Supabase under RLS; Demo = fictional in-memory data. */
export interface Repo {
  mode: "live" | "demo";
  basePath: "" | "/demo";
  todayIso: string;
  getProfile(): Promise<Profile>;
  getSettings(): Promise<UserSettings>;
  getEntitlements(): Promise<Entitlements>;
  getAiUsageThisMonth(): Promise<number>;
  listActiveProspects(): Promise<Prospect[]>;
  listProspects(f: ProspectFilters): Promise<{ rows: ProspectRow[]; total: number }>;
  getProspect(id: string): Promise<ProspectDetail | null>;
  listOpportunities(): Promise<OpportunityWithProspect[]>;
  listTasks(): Promise<Task[]>;
  listActivities(limit?: number): Promise<Activity[]>;
  listAiHistory(limit?: number): Promise<AiGeneration[]>;
  listProspectOptions(): Promise<{ id: string; business_name: string }[]>;
}
