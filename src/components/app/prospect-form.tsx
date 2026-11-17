"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, CircleHelp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, NativeSelect, Textarea } from "@/components/ui/primitives";
import { useAction, useAppMode } from "./mode";
import { createProspect, updateProspect } from "@/lib/actions/prospects";
import { COVERAGE_LINES, INDUSTRIES, type Prospect } from "@/lib/types";
import { cn } from "@/lib/utils";

type Errors = Record<string, string[] | undefined>;

export function ProspectForm({ prospect }: { prospect?: Prospect }) {
  const router = useRouter();
  const { href } = useAppMode();
  const { run, pending } = useAction();
  const [errors, setErrors] = useState<Errors>({});
  const [renewalDate, setRenewalDate] = useState(prospect?.renewal_date ?? "");
  const [renewalStatus, setRenewalStatus] = useState<"known" | "estimated">(prospect?.renewal_date_status === "estimated" ? "estimated" : "known");
  const [lines, setLines] = useState<string[]>(prospect?.coverage_lines ?? []);
  const p = prospect;

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.delete("coverage_lines[]");
    lines.forEach((l) => fd.append("coverage_lines[]", l));
    fd.set("renewal_date_status", renewalDate ? renewalStatus : "unknown");
    setErrors({});
    run(() => (p ? updateProspect(p.id, fd) : createProspect(fd)), {
      success: p ? "Prospect updated" : "Prospect added",
      onSuccess: (r) => router.push(href(`/prospects/${r.data.id}`)),
      onError: (r) => setErrors(r.fieldErrors ?? {}),
    });
  };

  const text = (name: keyof Prospect, label: string, props: React.ComponentProps<"input"> = {}) => (
    <Field label={label} htmlFor={name} error={errors[name]}>
      <Input id={name} name={name} defaultValue={(p?.[name] as string | number | null) ?? ""} aria-invalid={!!errors[name]} {...props} />
    </Field>
  );

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Business information</CardTitle>
          <CardDescription>Only enter what you know — blank fields are shown as unknown, never guessed.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {text("business_name", "Business name *", { required: true, maxLength: 200, autoFocus: !p })}
          <Field label="Industry" htmlFor="industry" error={errors.industry}>
            <NativeSelect id="industry" name="industry" defaultValue={p?.industry ?? ""}>
              <option value="">Unknown</option>
              {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
            </NativeSelect>
          </Field>
          {text("website", "Website", { placeholder: "example.com", inputMode: "url" })}
          {text("address", "Business address", { className: "sm:col-span-2" })}
          {text("city", "City")}
          <div className="grid grid-cols-2 gap-4">
            {text("state", "State", { maxLength: 2, placeholder: "TX", className: "uppercase" })}
            {text("zip", "ZIP code", { inputMode: "numeric", maxLength: 10 })}
          </div>
          {text("employee_count", "Employee count", { type: "number", min: 0, step: 1, inputMode: "numeric" })}
          {text("annual_revenue", "Est. annual revenue ($)", { inputMode: "decimal", placeholder: "e.g. 5000000" })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Primary contact</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {text("contact_name", "Contact name")}
          {text("contact_title", "Title")}
          {text("contact_email", "Email", { type: "email", inputMode: "email" })}
          {text("contact_phone", "Phone", { type: "tel", inputMode: "tel" })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Insurance information</CardTitle>
          <CardDescription>Renewal dates drive automatic outreach tasks (configurable in Settings).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {text("current_carrier", "Current carrier (if known)")}
          {text("current_agency", "Current agency / broker (if known)")}
          {text("estimated_premium", "Est. annual premium ($)", { inputMode: "decimal", placeholder: "e.g. 45000" })}

          <div className="grid gap-1.5 sm:col-span-2 lg:col-span-3">
            <span className="text-[13px] font-medium">Insurance renewal date</span>
            <div className="grid gap-2 sm:grid-cols-[200px_1fr] sm:items-center">
              <Input type="date" name="renewal_date" value={renewalDate} onChange={(e) => setRenewalDate(e.target.value)} aria-label="Renewal date" aria-invalid={!!errors.renewal_date} />
              {renewalDate ? (
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Renewal date certainty">
                  {(["known", "estimated"] as const).map((s) => (
                    <button
                      type="button"
                      key={s}
                      role="radio"
                      aria-checked={renewalStatus === s}
                      onClick={() => setRenewalStatus(s)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                        renewalStatus === s ? (s === "known" ? "border-primary bg-primary/10 text-primary" : "border-warning bg-warning/10 text-warning") : "hover:bg-muted",
                      )}
                    >
                      {s === "estimated" && <AlertTriangle className="size-3.5" />}
                      {s === "known" ? "Confirmed date" : "Estimate (unconfirmed)"}
                    </button>
                  ))}
                  <button type="button" onClick={() => setRenewalDate("")} className="text-sm text-muted-foreground underline-offset-2 hover:underline">Clear (unknown)</button>
                </div>
              ) : (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><CircleHelp className="size-4" /> Unknown — leave blank if you don&apos;t know it. ProducerOS will never guess.</p>
              )}
            </div>
            {errors.renewal_date && <p className="text-xs text-destructive">{errors.renewal_date[0]}</p>}
          </div>

          <fieldset className="grid gap-2 sm:col-span-2 lg:col-span-3">
            <legend className="mb-1 text-[13px] font-medium">Lines of coverage</legend>
            <div className="flex flex-wrap gap-2">
              {COVERAGE_LINES.map((c) => {
                const on = lines.includes(c.id);
                return (
                  <label key={c.id} className={cn("inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring", on ? "border-teal bg-accent text-accent-foreground" : "hover:bg-muted")}>
                    <input type="checkbox" className="sr-only" checked={on} onChange={() => setLines(on ? lines.filter((l) => l !== c.id) : [...lines, c.id])} />
                    {c.label}
                  </label>
                );
              })}
            </div>
          </fieldset>
          {text("lead_source", "Lead source", { placeholder: "Referral, cold call, event…" })}
          {text("next_follow_up_date", "Next follow-up date", { type: "date" })}
          {!p && (
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" name="add_to_pipeline" defaultChecked className="size-4 accent-[var(--primary)]" /> Add to sales pipeline
            </label>
          )}
          <Field label="Prospecting notes" htmlFor="notes" error={errors.notes} className="sm:col-span-2 lg:col-span-3">
            <Textarea id="notes" name="notes" rows={4} defaultValue={p?.notes ?? ""} maxLength={10000} />
          </Field>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t bg-background/90 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />} {p ? "Save changes" : "Add prospect"}</Button>
      </div>
    </form>
  );
}
