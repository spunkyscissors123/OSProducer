import { z } from "zod";
import { COVERAGE_IDS, STAGE_IDS } from "../types";

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : typeof v === "string" ? v.trim() : v);
const optText = (max: number) => z.preprocess(emptyToNull, z.string().max(max).nullable().default(null));
const optNumber = (max = 1e12) =>
  z.preprocess(
    (v) => {
      const e = emptyToNull(v);
      if (e === null || e === undefined) return null;
      if (typeof e === "string") return Number(e.replace(/[$,\s]/g, ""));
      return e;
    },
    z.number({ error: "Must be a number" }).min(0).max(max).nullable().default(null),
  );
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const optDate = z.preprocess(emptyToNull, isoDate.nullable().default(null));

export const prospectSchema = z
  .object({
    business_name: z.string().trim().min(1, "Business name is required").max(200),
    industry: optText(80),
    website: z.preprocess(
      emptyToNull,
      z
        .string()
        .max(300)
        .transform((v) => (/^https?:\/\//i.test(v) ? v : `https://${v}`))
        .pipe(z.url({ protocol: /^https?$/, error: "Enter a valid website" }))
        .nullable()
        .default(null),
    ),
    address: optText(300),
    city: optText(100),
    state: z.preprocess(
      (v) => (typeof emptyToNull(v) === "string" ? (emptyToNull(v) as string).toUpperCase() : emptyToNull(v)),
      z.string().regex(/^[A-Z]{2}$/, "Use 2-letter state").nullable().default(null),
    ),
    zip: z.preprocess(emptyToNull, z.string().regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP").nullable().default(null)),
    employee_count: optNumber(10_000_000).pipe(z.number().int("Whole number").nullable()),
    annual_revenue: optNumber(),
    contact_name: optText(120),
    contact_title: optText(120),
    contact_email: z.preprocess(emptyToNull, z.email("Invalid email").max(254).nullable().default(null)),
    contact_phone: optText(40),
    current_carrier: optText(120),
    current_agency: optText(120),
    renewal_date: optDate,
    renewal_date_status: z.enum(["known", "estimated", "unknown"]).default("unknown"),
    estimated_premium: optNumber(1e10),
    coverage_lines: z.array(z.enum(COVERAGE_IDS)).max(8).default([]),
    notes: optText(10000),
    lead_source: optText(120),
    next_follow_up_date: optDate,
  })
  .transform((p) => {
    // Enforce: no date → unknown; a date with status "unknown" is treated as known (user typed it).
    if (!p.renewal_date) return { ...p, renewal_date_status: "unknown" as const };
    if (p.renewal_date_status === "unknown") return { ...p, renewal_date_status: "known" as const };
    return p;
  });
export type ProspectInput = z.output<typeof prospectSchema>;

export const activitySchema = z.object({
  prospect_id: z.uuid(),
  type: z.enum(["call", "email", "meeting", "note"]),
  subject: z.string().trim().min(1, "Subject is required").max(200),
  body: optText(10000),
  occurred_at: z.preprocess(emptyToNull, z.iso.datetime({ local: true, offset: true }).nullable().default(null)),
  next_follow_up_date: optDate,
});

export const taskSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: optText(2000),
  due_date: isoDate,
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  prospect_id: z.preprocess(emptyToNull, z.uuid().nullable().default(null)),
});

export const opportunitySchema = z.object({
  prospect_id: z.uuid(),
  name: z.string().trim().min(1).max(200),
  stage: z.enum(STAGE_IDS).default("new_prospect"),
  estimated_premium: optNumber(1e10),
  close_probability: z.coerce.number().int().min(0).max(100).default(10),
  coverage_lines: z.array(z.enum(COVERAGE_IDS)).max(8).default([]),
  expected_close_date: optDate,
});

export const settingsSchema = z.object({
  full_name: optText(120),
  agency_name: optText(160),
  agency_commission_rate: z.coerce.number().min(0).max(100),
  new_business_split: z.coerce.number().min(0).max(100),
  renewal_split: z.coerce.number().min(0).max(100),
  renewal_offsets: z
    .array(z.coerce.number().int().min(1).max(365))
    .min(1, "Pick at least one offset")
    .max(8)
    .transform((a) => [...new Set(a)].sort((x, y) => y - x)),
  auto_renewal_tasks: z.boolean(),
});

export const AI_KINDS = [
  "intro_email",
  "cold_call_script",
  "follow_up_email",
  "discovery_questions",
  "linkedin_message",
  "summarize_notes",
  "next_actions",
  "industry_approach",
] as const;
export const AI_TONES = ["professional", "friendly", "direct", "consultative"] as const;

export const aiRequestSchema = z.object({
  kind: z.enum(AI_KINDS),
  tone: z.enum(AI_TONES).default("professional"),
  prospect_id: z.uuid().nullable().optional(),
  industry: z.string().trim().max(80).optional(),
  instructions: z.string().trim().max(1000).optional(),
});
export type AiRequest = z.infer<typeof aiRequestSchema>;

export function flattenErrors(err: z.ZodError): Record<string, string[] | undefined> {
  return z.flattenError(err).fieldErrors as Record<string, string[] | undefined>;
}
