import Papa from "papaparse";
import { prospectSchema, type ProspectInput } from "../validations";
import { COVERAGE_LINES, type CoverageLine, type Prospect } from "../types";

/** Header aliases → canonical prospect field. Matching is case/space/punctuation-insensitive. */
const HEADER_ALIASES: Record<string, keyof ProspectInput | "coverage"> = {
  businessname: "business_name", business: "business_name", company: "business_name", companyname: "business_name", name: "business_name", accountname: "business_name",
  industry: "industry", sector: "industry",
  website: "website", url: "website", web: "website",
  address: "address", street: "address", streetaddress: "address", businessaddress: "address",
  city: "city", state: "state", st: "state", zip: "zip", zipcode: "zip", postalcode: "zip", postal: "zip",
  employees: "employee_count", employeecount: "employee_count", numberofemployees: "employee_count",
  revenue: "annual_revenue", annualrevenue: "annual_revenue", estimatedannualrevenue: "annual_revenue",
  contact: "contact_name", contactname: "contact_name", contacttitle: "contact_title", title: "contact_title",
  email: "contact_email", contactemail: "contact_email", phone: "contact_phone", contactphone: "contact_phone",
  carrier: "current_carrier", currentcarrier: "current_carrier", insurancecarrier: "current_carrier",
  agency: "current_agency", currentagency: "current_agency", broker: "current_agency", currentbroker: "current_agency",
  renewaldate: "renewal_date", renewal: "renewal_date", xdate: "renewal_date", expirationdate: "renewal_date",
  renewaldatestatus: "renewal_date_status", renewalstatus: "renewal_date_status",
  premium: "estimated_premium", estimatedpremium: "estimated_premium", annualpremium: "estimated_premium",
  coverage: "coverage", coverages: "coverage", linesofcoverage: "coverage", lines: "coverage",
  notes: "notes", leadsource: "lead_source", source: "lead_source",
  nextfollowup: "next_follow_up_date", nextfollowupdate: "next_follow_up_date",
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

function parseCoverage(raw: string): CoverageLine[] {
  const parts = raw.split(/[;,|/]/).map((s) => norm(s)).filter(Boolean);
  const out = new Set<CoverageLine>();
  for (const p of parts) {
    const hit = COVERAGE_LINES.find(
      (c) => norm(c.id) === p || norm(c.label) === p || norm(c.short) === p ||
        (p === "wc" && c.id === "workers_comp") || (p === "workcomp" && c.id === "workers_comp") ||
        (p === "excess" && c.id === "umbrella") || (p === "eo" && c.id === "professional_liability") ||
        (p === "property" && c.id === "commercial_property") || (p === "auto" && c.id === "commercial_auto"),
    );
    out.add(hit ? hit.id : "other");
  }
  return [...out];
}

/** Normalize common date formats (MM/DD/YYYY, M/D/YY, YYYY-MM-DD) to ISO. Returns "" if unparseable. */
export function normalizeDate(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (m) {
    const yr = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const mo = Number(m[1]);
    const d = Number(m[2]);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return `${yr}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return "__invalid__";
}

export interface CsvRowResult {
  row: number;
  ok: boolean;
  data?: ProspectInput;
  errors?: string[];
}

export interface CsvParseResult {
  headers: string[];
  mapped: Record<string, string>;
  unmapped: string[];
  rows: CsvRowResult[];
  validCount: number;
  invalidCount: number;
}

export function parseProspectCsv(text: string, maxRows: number): CsvParseResult {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: "greedy" });
  const headers = parsed.meta.fields ?? [];
  const mapped: Record<string, string> = {};
  const unmapped: string[] = [];
  for (const h of headers) {
    const target = HEADER_ALIASES[norm(h)];
    if (target && !Object.values(mapped).includes(target)) mapped[h] = target;
    else unmapped.push(h);
  }

  const rows: CsvRowResult[] = parsed.data.slice(0, maxRows).map((raw, i) => {
    const obj: Record<string, unknown> = { coverage_lines: [] };
    for (const [header, field] of Object.entries(mapped)) {
      const v = (raw[header] ?? "").toString().trim();
      if (field === "coverage") obj.coverage_lines = v ? parseCoverage(v) : [];
      else if (field === "renewal_date" || field === "next_follow_up_date") {
        const d = normalizeDate(v);
        obj[field] = d === "__invalid__" ? v : d;
      } else if (field === "renewal_date_status") obj[field] = v.toLowerCase() || undefined;
      else obj[field] = v;
    }
    // CSV renewal dates without an explicit status are treated as "known" (user-provided data);
    // the schema forces "unknown" when the date is blank.
    const res = prospectSchema.safeParse(obj);
    if (res.success) return { row: i + 2, ok: true, data: res.data };
    return { row: i + 2, ok: false, errors: res.error.issues.map((iss) => `${iss.path.join(".") || "row"}: ${iss.message}`) };
  });

  return {
    headers,
    mapped,
    unmapped,
    rows,
    validCount: rows.filter((r) => r.ok).length,
    invalidCount: rows.filter((r) => !r.ok).length,
  };
}

export const EXPORT_COLUMNS: (keyof Prospect)[] = [
  "business_name", "industry", "website", "address", "city", "state", "zip", "employee_count", "annual_revenue",
  "contact_name", "contact_title", "contact_email", "contact_phone", "current_carrier", "current_agency",
  "renewal_date", "renewal_date_status", "estimated_premium", "coverage_lines", "lead_source", "data_source",
  "last_contacted_at", "next_follow_up_date", "notes", "created_at",
];

/** Neutralize spreadsheet formula injection (=, +, -, @, tab, CR at start of a cell). */
export function safeCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = Array.isArray(v) ? v.join("; ") : String(v);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

export function prospectsToCsv(prospects: Partial<Prospect>[]): string {
  return Papa.unparse({
    fields: EXPORT_COLUMNS as string[],
    data: prospects.map((p) => EXPORT_COLUMNS.map((c) => safeCell(p[c]))),
  });
}

export const CSV_TEMPLATE =
  "Business Name,Industry,Website,Address,City,State,ZIP,Employees,Annual Revenue,Contact Name,Contact Title,Email,Phone,Current Carrier,Current Agency,Renewal Date,Renewal Status,Estimated Premium,Coverage,Lead Source,Notes\n" +
  "Example Fabrication Co (fictional),Manufacturing,example.com,100 Example Way,Springfield,IL,62701,45,8500000,Jordan Sample,Operations Manager,jordan@example.com,555-0100,,,10/01/2027,known,42000,GL; Property; WC,Referral,Fictional sample row — replace with your data\n";
