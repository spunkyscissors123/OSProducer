import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/bits";
import { ProspectForm } from "@/components/app/prospect-form";
import type { ViewProps } from "./types";

export async function NewProspectView(_: ViewProps) {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Add prospect" description="Create a business prospect. Fields marked * are required." />
      <ProspectForm />
    </div>
  );
}

export async function EditProspectView({ repo, params }: ViewProps) {
  const detail = params?.id ? await repo.getProspect(params.id) : null;
  if (!detail) notFound();
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={`Edit ${detail.prospect.business_name}`} description="Changing the renewal date recalculates outreach tasks without creating duplicates." />
      <ProspectForm prospect={detail.prospect} />
    </div>
  );
}
