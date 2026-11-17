/**
 * Business-data provider integration layer.
 *
 * V1 ships with two sources only: records the producer entered manually and CSV files they imported.
 * Future licensed providers plug in by implementing `BusinessDataProvider` and registering below.
 * Rules for every provider:
 *  - Data must come from a properly licensed source with terms that permit this use.
 *  - No scraping of restricted websites.
 *  - Records are stored with data_source = "verified_provider" only when the provider attests to verification.
 *  - Fields the provider doesn't supply stay null (shown as "Unknown") — never filled with guesses.
 */
import type { CoverageLine } from "../types";

export interface BusinessSearchQuery {
  industry?: string;
  city?: string;
  state?: string;
  zip?: string;
  minEmployees?: number;
  maxEmployees?: number;
  niche?: string;
  limit?: number;
}

export interface ProviderBusiness {
  externalId: string;
  businessName: string;
  industry: string | null;
  naicsCode: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  website: string | null;
  employeeCount: number | null;
  annualRevenue: number | null;
  suggestedLines: CoverageLine[];
  verified: boolean;
  sourceAttribution: string;
}

export interface BusinessDataProvider {
  id: string;
  name: string;
  description: string;
  isConfigured(): boolean;
  search(q: BusinessSearchQuery): Promise<ProviderBusiness[]>;
}

export interface ProviderInfo {
  id: string;
  name: string;
  description: string;
  status: "active" | "not_configured" | "planned";
}

/** Registry shown in Prospect Finder. Add real providers here once licensed (keys go in server env). */
const REGISTRY: BusinessDataProvider[] = [];

export function listProviders(): ProviderInfo[] {
  return [
    { id: "manual", name: "Manually entered prospects", description: "Businesses you add yourself.", status: "active" },
    { id: "csv", name: "CSV-imported lists", description: "Lists you upload (e.g., association rosters you're licensed to use).", status: "active" },
    ...REGISTRY.map((p) => ({ id: p.id, name: p.name, description: p.description, status: p.isConfigured() ? ("active" as const) : ("not_configured" as const) })),
    { id: "licensed-firmographics", name: "Licensed firmographic data", description: "Planned: plug in a licensed business-data provider via the BusinessDataProvider interface.", status: "planned" },
  ];
}

export function getProvider(id: string): BusinessDataProvider | undefined {
  return REGISTRY.find((p) => p.id === id);
}
