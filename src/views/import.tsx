import { PageHeader } from "@/components/app/bits";
import { CsvImport } from "@/components/app/csv-import";
import type { ViewProps } from "./types";

export async function ImportView({ repo }: ViewProps) {
  const ent = await repo.getEntitlements();
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Import prospects" description="Bring in business lists from CSV. Rows are validated before anything is saved; unknown values stay unknown." />
      <CsvImport maxRows={ent.csvRowsPerImport} />
    </div>
  );
}
