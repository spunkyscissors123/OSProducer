/**
 * ENTIRELY FICTIONAL demo dataset. Business names, people, emails (example.com — reserved by RFC 2606),
 * and phone numbers (555-01xx — reserved for fiction) do not refer to real entities.
 * Dates are generated relative to "today" so the demo always shows upcoming renewals.
 * Demo data lives only in memory and is never written to the database.
 */
import { addDays } from "../domain/dates";
import { planRenewalTasks } from "../domain/renewals";
import type { Activity, CoverageLine, Opportunity, PipelineStage, Prospect, Task, UserSettings } from "../types";
import { DEFAULT_SETTINGS } from "../types";

type Seed = {
  name: string; industry: string; city: string; state: string; zip: string; employees: number; revenue: number;
  contact: string; title: string; carrier: string | null; agency: string | null; renewalIn: number | null; estimated?: boolean;
  premium: number | null; lines: CoverageLine[]; stage: PipelineStage | null; prob?: number; source: string; notes: string;
  contactedAgo?: number | null; createdAgo: number; wonAgo?: number; csv?: boolean;
};

const SEEDS: Seed[] = [
  { name: "Ridgeline Steel Fabricators", industry: "Manufacturing", city: "Fort Wayne", state: "IN", zip: "46802", employees: 85, revenue: 14_500_000, contact: "Dana Whitfield", title: "CFO", carrier: "Northbridge Mutual (fictional)", agency: null, renewalIn: 42, premium: 118_000, lines: ["general_liability", "commercial_property", "workers_comp", "umbrella"], stage: "quoting", prob: 55, source: "Referral", notes: "Expanded second shift this year. Interested in reviewing WC experience mod.", contactedAgo: 6, createdAgo: 95 },
  { name: "Copperfield Custom Homes", industry: "Construction", city: "Boise", state: "ID", zip: "83702", employees: 32, revenue: 9_200_000, contact: "Marcus Oyelaran", title: "Owner", carrier: null, agency: "Summit Ridge Insurance (fictional)", renewalIn: 18, premium: 64_000, lines: ["general_liability", "workers_comp", "commercial_auto"], stage: "proposal_presented", prob: 70, source: "Networking event", notes: "Uses subcontractors heavily — confirm COI process.", contactedAgo: 3, createdAgo: 120 },
  { name: "Bluewater Freight Lines", industry: "Transportation", city: "Savannah", state: "GA", zip: "31401", employees: 140, revenue: 31_000_000, contact: "Priya Raman", title: "Risk Manager", carrier: "Atlas Commercial (fictional)", agency: null, renewalIn: 74, premium: 410_000, lines: ["commercial_auto", "umbrella", "workers_comp"], stage: "discovery_completed", prob: 40, source: "Cold call", notes: "62 power units. Looking for better loss-control support.", contactedAgo: 12, createdAgo: 60 },
  { name: "Harborview Boutique Hotel", industry: "Hospitality", city: "Portland", state: "ME", zip: "04101", employees: 48, revenue: 6_800_000, contact: "Elena Castillo", title: "General Manager", carrier: null, agency: null, renewalIn: 105, estimated: true, premium: 52_000, lines: ["commercial_property", "general_liability", "workers_comp"], stage: "meeting_scheduled", prob: 25, source: "LinkedIn", notes: "Renewal month estimated from conversation — confirm.", contactedAgo: 9, createdAgo: 40 },
  { name: "Maple & Main Property Group", industry: "Real Estate", city: "Columbus", state: "OH", zip: "43215", employees: 14, revenue: 5_400_000, contact: "Gordon Achebe", title: "Managing Partner", carrier: "Keystone Specialty (fictional)", agency: null, renewalIn: 27, premium: 96_000, lines: ["commercial_property", "general_liability", "umbrella"], stage: "contacted", prob: 15, source: "Referral", notes: "11 mixed-use buildings. Property values need updated SOV.", contactedAgo: 41, createdAgo: 30 },
  { name: "Lakeshore Engineering Partners", industry: "Professional Services", city: "Madison", state: "WI", zip: "53703", employees: 26, revenue: 4_900_000, contact: "Hannah Lindqvist", title: "Principal", carrier: null, agency: null, renewalIn: null, premium: 38_000, lines: ["professional_liability", "cyber", "general_liability"], stage: "researching", prob: 10, source: "Website inquiry", notes: "Asked about E&O limits for municipal contracts.", contactedAgo: null, createdAgo: 8 },
  { name: "Pinecrest Precision Machining", industry: "Manufacturing", city: "Grand Rapids", state: "MI", zip: "49503", employees: 58, revenue: 11_000_000, contact: "Tomás Herrera", title: "President", carrier: null, agency: null, renewalIn: 88, premium: 72_000, lines: ["general_liability", "commercial_property", "workers_comp"], stage: "new_prospect", prob: 5, source: "CSV list", notes: "", contactedAgo: null, createdAgo: 4, csv: true },
  { name: "Summit Roofing & Exteriors", industry: "Construction", city: "Denver", state: "CO", zip: "80202", employees: 44, revenue: 7_600_000, contact: "Keisha Barnes", title: "Operations Director", carrier: "Frontier Casualty (fictional)", agency: null, renewalIn: 56, premium: 135_000, lines: ["general_liability", "workers_comp", "commercial_auto", "umbrella"], stage: "contacted", prob: 15, source: "Cold call", notes: "Roofing class — GL market is tight. Ask about safety program.", contactedAgo: 20, createdAgo: 50 },
  { name: "Golden Prairie Logistics", industry: "Transportation", city: "Omaha", state: "NE", zip: "68102", employees: 75, revenue: 18_000_000, contact: "Ravi Subramanian", title: "COO", carrier: null, agency: null, renewalIn: 116, premium: 260_000, lines: ["commercial_auto", "umbrella"], stage: "new_prospect", prob: 5, source: "Trade association", notes: "", contactedAgo: null, createdAgo: 2 },
  { name: "Cedar Grove Senior Living", industry: "Healthcare", city: "Asheville", state: "NC", zip: "28801", employees: 110, revenue: 12_300_000, contact: "Margaret Osei", title: "Executive Director", carrier: null, agency: null, renewalIn: null, premium: null, lines: ["professional_liability", "general_liability", "commercial_property"], stage: "researching", prob: 10, source: "Referral", notes: "Renewal date unknown — ask at first meeting.", contactedAgo: null, createdAgo: 15 },
  { name: "Tidewater Seafood Kitchen", industry: "Hospitality", city: "Norfolk", state: "VA", zip: "23510", employees: 36, revenue: 3_100_000, contact: "Andre Fontaine", title: "Owner", carrier: null, agency: null, renewalIn: 33, premium: 28_000, lines: ["general_liability", "commercial_property", "workers_comp"], stage: "meeting_scheduled", prob: 25, source: "Walk-in", notes: "Liquor liability needed.", contactedAgo: 5, createdAgo: 22 },
  { name: "Brightline Software Studio", industry: "Technology", city: "Austin", state: "TX", zip: "78701", employees: 22, revenue: 4_200_000, contact: "Sofia Petrov", title: "CEO", carrier: null, agency: null, renewalIn: 140, premium: 24_000, lines: ["cyber", "professional_liability"], stage: "won", prob: 100, source: "Referral", notes: "Bound cyber + tech E&O.", contactedAgo: 30, createdAgo: 160, wonAgo: 35 },
  { name: "Ironwood Excavation Co", industry: "Construction", city: "Spokane", state: "WA", zip: "99201", employees: 29, revenue: 6_100_000, contact: "Wade Lindgren", title: "Owner", carrier: null, agency: null, renewalIn: 210, premium: 88_000, lines: ["general_liability", "commercial_auto", "workers_comp", "other"], stage: "won", prob: 100, source: "Networking event", notes: "Includes inland marine for equipment.", contactedAgo: 60, createdAgo: 220, wonAgo: 95 },
  { name: "Riverbend Dental Group", industry: "Healthcare", city: "Chattanooga", state: "TN", zip: "37402", employees: 18, revenue: 3_800_000, contact: "Dr. Lena Moss", title: "Practice Owner", carrier: null, agency: null, renewalIn: 165, premium: 19_000, lines: ["professional_liability", "commercial_property", "cyber"], stage: "won", prob: 100, source: "Referral", notes: "", contactedAgo: 90, createdAgo: 300, wonAgo: 160 },
  { name: "Northgate Office Commons", industry: "Real Estate", city: "Minneapolis", state: "MN", zip: "55401", employees: 9, revenue: 2_900_000, contact: "Charles Dubois", title: "Asset Manager", carrier: null, agency: null, renewalIn: 64, premium: 57_000, lines: ["commercial_property", "general_liability"], stage: "lost", prob: 0, source: "Cold call", notes: "Lost on price; incumbent renewed flat.", contactedAgo: 70, createdAgo: 190 },
  { name: "Cobalt Packaging Solutions", industry: "Manufacturing", city: "Louisville", state: "KY", zip: "40202", employees: 120, revenue: 22_000_000, contact: "Yvonne Mbeki", title: "Controller", carrier: null, agency: null, renewalIn: 97, premium: 165_000, lines: ["general_liability", "commercial_property", "workers_comp", "umbrella", "commercial_auto"], stage: "quoting", prob: 55, source: "Referral", notes: "Product recall coverage question pending.", contactedAgo: 2, createdAgo: 75 },
  { name: "Crescent Accounting Advisors", industry: "Professional Services", city: "Tampa", state: "FL", zip: "33602", employees: 12, revenue: 2_200_000, contact: "Imran Qureshi", title: "Managing Partner", carrier: null, agency: null, renewalIn: 46, premium: 16_500, lines: ["professional_liability", "cyber"], stage: "proposal_presented", prob: 70, source: "LinkedIn", notes: "", contactedAgo: 8, createdAgo: 45 },
  { name: "Evergreen Landscape Services", industry: "Construction", city: "Raleigh", state: "NC", zip: "27601", employees: 38, revenue: 4_400_000, contact: "Luis Navarro", title: "Owner", carrier: null, agency: null, renewalIn: 12, premium: 41_000, lines: ["general_liability", "commercial_auto", "workers_comp"], stage: "contacted", prob: 15, source: "CSV list", notes: "", contactedAgo: 45, createdAgo: 28, csv: true },
  { name: "Silver Spur Trucking", industry: "Transportation", city: "Amarillo", state: "TX", zip: "79101", employees: 21, revenue: 5_000_000, contact: "Becca Holloway", title: "Office Manager", carrier: null, agency: null, renewalIn: 81, estimated: true, premium: 95_000, lines: ["commercial_auto", "other"], stage: "new_prospect", prob: 5, source: "CSV list", notes: "Renewal estimated from filing season — unverified.", contactedAgo: null, createdAgo: 1, csv: true },
  { name: "Lantern House Bistro Group", industry: "Hospitality", city: "Charleston", state: "SC", zip: "29401", employees: 64, revenue: 5_900_000, contact: "Naomi Fischer", title: "Director of Ops", carrier: null, agency: null, renewalIn: null, premium: 46_000, lines: ["general_liability", "commercial_property", "workers_comp", "umbrella"], stage: null, source: "CSV list", notes: "", contactedAgo: null, createdAgo: 1, csv: true },
  { name: "Oakmont Industrial Supply", industry: "Wholesale & Distribution", city: "Toledo", state: "OH", zip: "43604", employees: 52, revenue: 16_000_000, contact: "Victor Alvarez", title: "VP Finance", carrier: null, agency: null, renewalIn: 125, premium: 78_000, lines: ["general_liability", "commercial_property", "commercial_auto"], stage: null, source: "CSV list", notes: "", contactedAgo: null, createdAgo: 1, csv: true },
  { name: "Westfield Architecture Studio", industry: "Professional Services", city: "Pittsburgh", state: "PA", zip: "15222", employees: 16, revenue: 3_300_000, contact: "Grace Kim", title: "Principal", carrier: null, agency: null, renewalIn: 230, premium: 22_000, lines: ["professional_liability", "general_liability"], stage: "won", prob: 100, source: "Referral", notes: "", contactedAgo: 120, createdAgo: 330, wonAgo: 250 },
  { name: "Prairie Wind Apartments", industry: "Real Estate", city: "Wichita", state: "KS", zip: "67202", employees: 7, revenue: 3_600_000, contact: "Henry Castellanos", title: "Owner", carrier: null, agency: null, renewalIn: 69, premium: 61_000, lines: ["commercial_property", "general_liability", "umbrella"], stage: "researching", prob: 10, source: "Cold call", notes: "", contactedAgo: null, createdAgo: 12 },
  { name: "Granite State Millwork", industry: "Manufacturing", city: "Manchester", state: "NH", zip: "03101", employees: 34, revenue: 5_800_000, contact: "Owen Fairbanks", title: "Owner", carrier: null, agency: null, renewalIn: 200, premium: 47_000, lines: ["general_liability", "commercial_property", "workers_comp"], stage: "won", prob: 100, source: "Trade association", notes: "", contactedAgo: 80, createdAgo: 260, wonAgo: 200 },
];

const id = (prefix: string, n: number) => `${prefix}0000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, "").slice(0, 18);

export interface DemoData {
  prospects: Prospect[];
  opportunities: Opportunity[];
  activities: Activity[];
  tasks: Task[];
  settings: UserSettings;
}

export function buildDemoData(todayIso: string): DemoData {
  const ts = (daysAgo: number, hour = 15) => `${addDays(todayIso, -daysAgo)}T${String(hour).padStart(2, "0")}:00:00.000Z`;
  const prospects: Prospect[] = [];
  const opportunities: Opportunity[] = [];
  const activities: Activity[] = [];
  const tasks: Task[] = [];

  SEEDS.forEach((s, i) => {
    const pid = id("aaaa", i + 1);
    const renewal = s.renewalIn === null ? null : addDays(todayIso, s.renewalIn);
    const first = s.contact.replace(/^Dr\. /, "").split(" ")[0].toLowerCase();
    prospects.push({
      id: pid, business_name: s.name, industry: s.industry, website: `https://${slug(s.name)}.example.com`,
      address: `${100 + i * 17} Example Avenue`, city: s.city, state: s.state, zip: s.zip, employee_count: s.employees,
      annual_revenue: s.revenue, contact_name: s.contact, contact_title: s.title, contact_email: `${first}@${slug(s.name)}.example.com`,
      contact_phone: `(555) 01${String(i).padStart(2, "0")}-${String(1000 + i * 7).slice(0, 4)}`,
      current_carrier: s.carrier, current_agency: s.agency, renewal_date: renewal,
      renewal_date_status: renewal ? (s.estimated ? "estimated" : "known") : "unknown",
      estimated_premium: s.premium, coverage_lines: s.lines, notes: s.notes || null, lead_source: s.source,
      data_source: s.csv ? "csv_import" : "user_entered",
      last_contacted_at: s.contactedAgo == null ? null : ts(s.contactedAgo),
      next_follow_up_date: s.stage && !["won", "lost"].includes(s.stage) ? addDays(todayIso, ((i * 5) % 13) - 4) : null,
      archived_at: null, created_at: ts(s.createdAgo, 13), updated_at: ts(Math.min(s.createdAgo, s.contactedAgo ?? s.createdAgo)),
    });

    if (s.stage) {
      const oid = id("bbbb", i + 1);
      opportunities.push({
        id: oid, prospect_id: pid, name: `${s.name} — commercial package`, stage: s.stage, estimated_premium: s.premium,
        close_probability: s.prob ?? 10, coverage_lines: s.lines, expected_close_date: renewal,
        stage_changed_at: ts(Math.max(0, (s.contactedAgo ?? 3) - 1)), won_at: s.wonAgo != null ? ts(s.wonAgo) : null,
        lost_at: s.stage === "lost" ? ts(20) : null, lost_reason: s.stage === "lost" ? "Incumbent renewed flat" : null,
        created_at: ts(s.createdAgo, 13),
      });
    }

    if (s.contactedAgo != null) {
      activities.push(
        { id: id("cccc", i * 3 + 1), prospect_id: pid, opportunity_id: null, type: "call", subject: `Intro call with ${s.contact}`, body: "Discussed current program and timing.", occurred_at: ts(s.contactedAgo, 16), prospect: { business_name: s.name } },
        { id: id("cccc", i * 3 + 2), prospect_id: pid, opportunity_id: null, type: "email", subject: "Sent follow-up with meeting options", body: null, occurred_at: ts(s.contactedAgo + 2, 14), prospect: { business_name: s.name } },
      );
      if (s.stage === "meeting_scheduled" || s.stage === "discovery_completed" || s.stage === "quoting") {
        activities.push({ id: id("cccc", i * 3 + 3), prospect_id: pid, opportunity_id: null, type: "meeting", subject: "Discovery meeting", body: "Reviewed operations, loss history, and decision timeline.", occurred_at: ts(Math.max(0, s.contactedAgo - 1), 18), prospect: { business_name: s.name } });
      }
    }

    planRenewalTasks({ businessName: s.name, renewalDate: renewal, renewalStatus: renewal ? (s.estimated ? "estimated" : "known") : "unknown", offsets: DEFAULT_SETTINGS.renewal_offsets, todayIso: addDays(todayIso, -30) })
      .filter((t) => s.stage !== "won" && s.stage !== "lost")
      .forEach((t, j) =>
        tasks.push({
          id: id("dddd", i * 10 + j), prospect_id: pid, title: t.title, description: t.description, due_date: t.due_date, priority: t.priority,
          status: t.due_date < addDays(todayIso, -10) && i % 2 === 0 ? "completed" : "open",
          completed_at: t.due_date < addDays(todayIso, -10) && i % 2 === 0 ? ts(12) : null,
          source: "renewal", renewal_cycle_date: renewal, renewal_offset_days: t.offset_days, created_at: ts(30), prospect: { business_name: s.name },
        }),
      );
  });

  const manual: [number, string, number, Task["priority"]][] = [
    [0, "Send loss-run request letter", 0, "high"],
    [2, "Prep carrier submissions for fleet", 1, "medium"],
    [4, "Call Gordon re: updated building values", -3, "high"],
    [10, "Confirm liquor liability details", 2, "medium"],
    [15, "Review recall coverage options", 0, "medium"],
    [16, "Send proposal recap email", -1, "high"],
    [22, "Research operations & leadership", 4, "low"],
  ];
  manual.forEach(([idx, title, due, priority], j) =>
    tasks.push({
      id: id("eeee", j + 1), prospect_id: id("aaaa", idx + 1), title, description: null, due_date: addDays(todayIso, due), priority,
      status: "open", completed_at: null, source: "manual", renewal_cycle_date: null, renewal_offset_days: null, created_at: ts(5),
      prospect: { business_name: SEEDS[idx].name },
    }),
  );

  return { prospects, opportunities, activities, tasks, settings: DEFAULT_SETTINGS };
}
