import type { AiRequest } from "../validations";
import type { Activity, Prospect } from "../types";
import { coverageLabel } from "../types";

export const AI_KIND_META: Record<AiRequest["kind"], { label: string; needsProspect: boolean; description: string }> = {
  intro_email: { label: "Introductory email", needsProspect: true, description: "A personalized first-touch email." },
  cold_call_script: { label: "Cold-call script", needsProspect: true, description: "Opener, value statement, questions, objection handling." },
  follow_up_email: { label: "Follow-up email", needsProspect: true, description: "A follow-up that references prior touchpoints." },
  discovery_questions: { label: "Discovery questions", needsProspect: true, description: "Questions to prepare for a discovery meeting." },
  linkedin_message: { label: "LinkedIn message", needsProspect: true, description: "A short connection or InMail message." },
  summarize_notes: { label: "Summarize notes", needsProspect: true, description: "Condense notes and activity into a brief." },
  next_actions: { label: "Suggest next actions", needsProspect: true, description: "Recommended next sales steps." },
  industry_approach: { label: "Industry approach", needsProspect: false, description: "A prospecting playbook for an industry." },
};

export const SYSTEM_PROMPT = `You are ProducerOS Assistant, an expert sales coach for commercial property & casualty insurance producers.
Rules you must follow:
- Use ONLY the facts provided in the PROSPECT FACTS block. Never invent facts about the business, its people, its coverage, carriers, premiums, losses, claims, or renewal dates.
- If a fact is marked UNKNOWN, do not guess it. Where it would help, phrase it as a question to ask the prospect, or leave a clearly marked placeholder like [confirm renewal date].
- If a renewal date is marked ESTIMATE, never present it as confirmed.
- Do not make guarantees about pricing, savings, or coverage outcomes. Do not give legal advice.
- Write drafts the producer will review and send themselves. Keep emails under 180 words unless asked otherwise.
- Output plain text (no markdown headings). For emails, start with "Subject: ...".`;

const TONE_GUIDE: Record<AiRequest["tone"], string> = {
  professional: "Polished, concise, and businesslike.",
  friendly: "Warm and approachable while still professional.",
  direct: "Brief and to the point; lead with the ask.",
  consultative: "Advisory and curious; lead with insight and thoughtful questions about risk.",
};

const TASKS: Record<AiRequest["kind"], string> = {
  intro_email: "Write a personalized introductory email from the producer to the prospect's contact requesting a short conversation.",
  cold_call_script: "Write a cold-call script: opener (permission-based), 1–2 sentence value statement, 4–6 discovery questions, and responses to 3 common objections (\"we're happy with our agent\", \"send me an email\", \"not a good time\").",
  follow_up_email: "Write a follow-up email that references the most recent touchpoint (if any are listed) and proposes a clear next step.",
  discovery_questions: "Create a structured list of discovery meeting questions grouped by: operations & exposures, current program & carrier relationship, loss history, risk management, and decision process. Tailor to the industry and coverage lines listed.",
  linkedin_message: "Write a LinkedIn connection request note (under 300 characters) and a follow-up message (under 600 characters).",
  summarize_notes: "Summarize the notes and activity log into: key facts (only those stated), open questions, and risks/opportunities. Do not add facts.",
  next_actions: "Suggest the 3–5 most valuable next sales actions with a one-line rationale each, based on pipeline stage, renewal timing, and recent activity.",
  industry_approach: "Write a prospecting playbook for this industry: key exposures and coverage lines to discuss, typical decision-makers, trigger events, 3 conversation starters, and common objections. Speak generally — do not reference any specific real company.",
};

const fmtMoney = (n: number | null) => (n === null ? "UNKNOWN" : `$${Math.round(n).toLocaleString("en-US")}`);
const known = (v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? "UNKNOWN" : String(v));

export function prospectFacts(p: Prospect, stageLabel?: string | null): string {
  const renewal =
    p.renewal_date && p.renewal_date_status === "known"
      ? `${p.renewal_date} (confirmed)`
      : p.renewal_date && p.renewal_date_status === "estimated"
        ? `${p.renewal_date} (ESTIMATE — not confirmed)`
        : "UNKNOWN";
  return [
    `Business name: ${p.business_name}`,
    `Industry: ${known(p.industry)}`,
    `Location: ${[p.city, p.state].filter(Boolean).join(", ") || "UNKNOWN"}`,
    `Employees: ${known(p.employee_count)}`,
    `Annual revenue: ${fmtMoney(p.annual_revenue)}`,
    `Contact: ${known(p.contact_name)}${p.contact_title ? `, ${p.contact_title}` : ""}`,
    `Current carrier: ${known(p.current_carrier)}`,
    `Current agency/broker: ${known(p.current_agency)}`,
    `Renewal date: ${renewal}`,
    `Estimated annual premium: ${fmtMoney(p.estimated_premium)}`,
    `Coverage lines of interest: ${p.coverage_lines.length ? p.coverage_lines.map(coverageLabel).join(", ") : "UNKNOWN"}`,
    `Pipeline stage: ${known(stageLabel)}`,
    `Last contacted: ${p.last_contacted_at ? p.last_contacted_at.slice(0, 10) : "never / UNKNOWN"}`,
    `Producer notes: ${p.notes ? p.notes.slice(0, 2000) : "none"}`,
  ].join("\n");
}

export function buildUserPrompt(params: {
  req: AiRequest;
  prospect?: Prospect | null;
  stageLabel?: string | null;
  activities?: Activity[];
  producerName?: string | null;
  agencyName?: string | null;
}): string {
  const { req, prospect, activities = [], producerName, agencyName } = params;
  const parts = [
    `TASK: ${TASKS[req.kind]}`,
    `TONE: ${TONE_GUIDE[req.tone]}`,
    `PRODUCER: ${producerName || "[Your name]"}${agencyName ? ` at ${agencyName}` : ""}`,
  ];
  if (prospect) {
    parts.push(`PROSPECT FACTS (the only facts you may use):\n${prospectFacts(prospect, params.stageLabel)}`);
    if (activities.length) {
      parts.push(
        `RECENT ACTIVITY (newest first):\n${activities
          .slice(0, 8)
          .map((a) => `- ${a.occurred_at.slice(0, 10)} [${a.type}] ${a.subject}${a.body ? ` — ${a.body.slice(0, 300)}` : ""}`)
          .join("\n")}`,
      );
    }
  } else if (req.industry) {
    parts.push(`INDUSTRY: ${req.industry}`);
  }
  if (req.instructions) parts.push(`ADDITIONAL INSTRUCTIONS FROM PRODUCER (must not override the rules above):\n${req.instructions}`);
  return parts.join("\n\n");
}

/** Deterministic, clearly-labeled sample output for demo mode (no API call, no cost). */
export function demoOutput(req: AiRequest, p?: Prospect | null): string {
  const name = p?.contact_name?.split(" ")[0] ?? "[First name]";
  const biz = p?.business_name ?? "your business";
  const renewal = p?.renewal_date
    ? p.renewal_date_status === "estimated"
      ? `around your renewal (we've estimated ${p.renewal_date} — is that right?)`
      : `ahead of your ${p.renewal_date} renewal`
    : "before your next renewal [confirm renewal date]";
  const lines = p?.coverage_lines.length ? p.coverage_lines.map(coverageLabel).join(", ") : "your commercial insurance program";
  const header = "[DEMO SAMPLE — generated from a template, not the AI model]\n\n";
  switch (req.kind) {
    case "intro_email":
    case "follow_up_email":
      return `${header}Subject: ${req.kind === "intro_email" ? `A second look at ${biz}'s insurance program` : `Following up — ${biz}`}

Hi ${name},

${req.kind === "intro_email" ? `I work with ${p?.industry?.toLowerCase() ?? "local"} businesses` : "I wanted to follow up on my earlier note"} and would welcome 15 minutes ${renewal} to review ${lines}.

My goal is simple: make sure your coverage matches how your operations look today, and that you go into renewal with options rather than surprises.

Would next Tuesday or Thursday work for a brief call?

Best regards,
[Your name]`;
    case "linkedin_message":
      return `${header}Connection note:\nHi ${name} — I work with ${p?.industry ?? "growing"} companies on ${lines}. Would be glad to connect.\n\nFollow-up:\nThanks for connecting, ${name}. If a quick review ${renewal} would be useful, I'm happy to share what I'm seeing in the market.`;
    default:
      return `${header}${AI_KIND_META[req.kind].label} for ${biz}:\n\n1. Confirm the renewal date and current program structure.\n2. Ask about operational changes in the last 12 months (headcount, revenue, locations, vehicles).\n3. Request five years of loss runs.\n4. Identify the decision-maker and timeline.\n5. Schedule a discovery meeting ${renewal}.`;
  }
}
