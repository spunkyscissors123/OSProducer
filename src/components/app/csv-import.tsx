"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { useAction, useAppMode } from "./mode";
import { CSV_TEMPLATE, parseProspectCsv, type CsvParseResult } from "@/lib/domain/csv";
import { importProspectsCsv } from "@/lib/actions/prospects";
import { formatCurrency } from "@/lib/utils";

export function CsvImport({ maxRows }: { maxRows: number }) {
  const router = useRouter();
  const { href, isDemo } = useAppMode();
  const { run, pending } = useAction();
  const [text, setText] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<CsvParseResult | null>(null);
  const [addToPipeline, setAddToPipeline] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: { row: number; errors: string[] }[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const limit = maxRows > 0 ? maxRows : 250;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 5_000_000) return alert("File is too large (5 MB max).");
    const t = await file.text();
    setFileName(file.name);
    setText(t);
    setResult(null);
    setPreview(parseProspectCsv(t, limit));
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "producer-os-import-template.csv" });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle>1. Choose a CSV file</CardTitle>
          <CardDescription>
            Columns are matched automatically (e.g. “Company”, “Renewal Date”, “Premium”, “Coverage”). Up to {limit.toLocaleString()} rows per import on your plan.
            Only import lists you&apos;re authorized to use.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); void onFile(e.dataTransfer.files[0]); }}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors hover:border-primary hover:bg-primary/5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
          >
            <FileSpreadsheet className="size-8 text-primary" />
            <span className="text-sm font-medium">{fileName || "Drop a .csv file here or click to browse"}</span>
            <span className="text-xs text-muted-foreground">Max 5 MB</span>
            <input ref={inputRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
          </label>
          <Button variant="ghost" size="sm" className="justify-self-start" onClick={downloadTemplate}><Download /> Download template</Button>
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle>2. Review</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2">
              <Badge variant="success"><CheckCircle2 /> {preview.validCount} valid</Badge>
              {preview.invalidCount > 0 && <Badge variant="danger"><XCircle /> {preview.invalidCount} with errors (skipped)</Badge>}
              <span>Mapped: {Object.entries(preview.mapped).map(([h, f]) => `${h} → ${f}`).join(", ") || "none"}</span>
              {preview.unmapped.length > 0 && <span>· Ignored: {preview.unmapped.join(", ")}</span>}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="max-h-96 overflow-auto rounded-lg border">
              <Table>
                <THead><TR className="hover:bg-transparent"><TH>Row</TH><TH>Business</TH><TH>Location</TH><TH>Renewal</TH><TH className="text-right">Premium</TH><TH>Status</TH></TR></THead>
                <TBody>
                  {preview.rows.slice(0, 200).map((r) => (
                    <TR key={r.row}>
                      <TD className="text-muted-foreground tabular">{r.row}</TD>
                      <TD className="font-medium">{r.data?.business_name ?? "—"}</TD>
                      <TD>{[r.data?.city, r.data?.state].filter(Boolean).join(", ") || "—"}</TD>
                      <TD className="tabular">{r.data?.renewal_date ? `${r.data.renewal_date}${r.data.renewal_date_status === "estimated" ? " (est.)" : ""}` : <span className="italic text-muted-foreground">Unknown</span>}</TD>
                      <TD className="text-right tabular">{formatCurrency(r.data?.estimated_premium)}</TD>
                      <TD>{r.ok ? <Badge variant="success">OK</Badge> : <span className="text-xs text-destructive">{r.errors?.join("; ")}</span>}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={addToPipeline} onChange={(e) => setAddToPipeline(e.target.checked)} className="size-4 accent-[var(--primary)]" />
              Also add imported businesses to the sales pipeline (otherwise they stay in Prospect Finder)
            </label>
            <Button
              className="justify-self-end"
              disabled={pending || preview.validCount === 0}
              onClick={() =>
                run(() => importProspectsCsv(text ?? "", addToPipeline), {
                  success: undefined,
                  onSuccess: (r) => setResult(r.data),
                })
              }
            >
              {pending ? <Loader2 className="animate-spin" /> : <Upload />} Import {preview.validCount} prospect{preview.validCount === 1 ? "" : "s"}
            </Button>
            {isDemo && <p className="text-right text-xs text-muted-foreground">Preview works in demo; importing requires an account.</p>}
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="border-success/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <p className="text-sm"><CheckCircle2 className="mr-1 inline size-4 text-success" /> Imported <strong>{result.imported}</strong> prospects{result.skipped ? `, skipped ${result.skipped}` : ""}. Renewal tasks were created for rows with renewal dates.</p>
            <Button onClick={() => router.push(href("/finder"))}>View in Prospect Finder</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
