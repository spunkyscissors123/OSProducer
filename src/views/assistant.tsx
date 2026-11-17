import { PageHeader } from "@/components/app/bits";
import { AiAssistant } from "@/components/app/ai-assistant";
import type { AI_KINDS } from "@/lib/validations";
import { sp, type ViewProps } from "./types";

export async function AssistantView({ repo, searchParams }: ViewProps) {
  const [prospects, ent, usage, history] = await Promise.all([repo.listProspectOptions(), repo.getEntitlements(), repo.getAiUsageThisMonth(), repo.listAiHistory(8)]);
  return (
    <>
      <PageHeader
        title="AI prospecting assistant"
        description={repo.mode === "demo" ? "Demo mode returns template samples (no AI call). Sign up to generate real drafts." : "Personalized outreach, call scripts and discovery prep — grounded in your prospect data."}
      />
      <AiAssistant
        prospects={prospects}
        initialProspect={sp(searchParams, "prospect")}
        initialKind={sp(searchParams, "kind") as (typeof AI_KINDS)[number] | undefined}
        usage={usage}
        limit={ent.aiGenerationsPerMonth}
        history={history}
      />
    </>
  );
}
