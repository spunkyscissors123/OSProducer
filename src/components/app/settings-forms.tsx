"use client";
import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input } from "@/components/ui/primitives";
import { DEMO_TOAST, useAction, useAppMode } from "./mode";
import { recalculateRenewalTasks, updateSettings } from "@/lib/actions/settings";
import type { Profile, UserSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

const OFFSET_CHOICES = [180, 150, 120, 90, 75, 60, 45, 30, 14, 7];

export function RecalculateButton() {
  const { run, pending } = useAction();
  return (
    <Button variant="outline" disabled={pending} onClick={() => run(() => recalculateRenewalTasks(), { onSuccess: (r) => toast.success(`Schedules recalculated for ${r.data.prospects} prospects · ${r.data.created} new task(s), no duplicates`) })}>
      {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />} Recalculate tasks
    </Button>
  );
}

export function SettingsForm({ profile, settings }: { profile: Profile; settings: UserSettings }) {
  const { run, pending } = useAction();
  const [offsets, setOffsets] = useState<number[]>(settings.renewal_offsets);
  const [auto, setAuto] = useState(settings.auto_renewal_tasks);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        run(
          () => updateSettings({
            full_name: fd.get("full_name"), agency_name: fd.get("agency_name"),
            agency_commission_rate: fd.get("agency_commission_rate"), new_business_split: fd.get("new_business_split"), renewal_split: fd.get("renewal_split"),
            renewal_offsets: offsets, auto_renewal_tasks: auto,
          }),
          { success: "Settings saved. Use “Recalculate tasks” to apply schedule changes to existing prospects.", onError: (r) => setErrors(r.fieldErrors ?? {}) },
        );
      }}
    >
      <Card>
        <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="full_name" error={errors.full_name}><Input id="full_name" name="full_name" defaultValue={profile.full_name ?? ""} maxLength={120} /></Field>
          <Field label="Agency name" htmlFor="agency_name" error={errors.agency_name}><Input id="agency_name" name="agency_name" defaultValue={profile.agency_name ?? ""} maxLength={160} /></Field>
          <Field label="Email" htmlFor="email" hint="Managed by your login"><Input id="email" value={profile.email ?? ""} disabled /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Commission defaults</CardTitle>
          <CardDescription>Used for every commission estimate across ProducerOS.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Avg. agency commission rate (%)" htmlFor="rate" error={errors.agency_commission_rate}><Input id="rate" name="agency_commission_rate" type="number" min={0} max={100} step={0.5} defaultValue={settings.agency_commission_rate} /></Field>
          <Field label="Producer new-business split (%)" htmlFor="nb" error={errors.new_business_split}><Input id="nb" name="new_business_split" type="number" min={0} max={100} step={1} defaultValue={settings.new_business_split} /></Field>
          <Field label="Producer renewal split (%)" htmlFor="rn" error={errors.renewal_split}><Input id="rn" name="renewal_split" type="number" min={0} max={100} step={1} defaultValue={settings.renewal_split} /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Renewal outreach schedule</CardTitle>
          <CardDescription>Tasks are created this many days before each known or estimated renewal date. Re-running never creates duplicates.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="size-4 accent-[var(--primary)]" />
            Automatically create renewal outreach tasks
          </label>
          <fieldset disabled={!auto} className="disabled:opacity-50">
            <legend className="mb-2 text-[13px] font-medium">Days before renewal</legend>
            <div className="flex flex-wrap gap-2">
              {OFFSET_CHOICES.map((o) => {
                const on = offsets.includes(o);
                return (
                  <button type="button" key={o} aria-pressed={on} onClick={() => setOffsets(on ? offsets.filter((x) => x !== o) : [...offsets, o].sort((a, b) => b - a))}
                    className={cn("rounded-lg border px-3 py-1.5 text-sm tabular transition-colors", on ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-muted")}
                  >
                    {o} days
                  </button>
                );
              })}
            </div>
            {errors.renewal_offsets && <p className="mt-1 text-xs text-destructive">{errors.renewal_offsets[0]}</p>}
          </fieldset>
          <div className="flex flex-wrap items-center gap-3"><RecalculateButton /><span className="text-xs text-muted-foreground">Applies the saved schedule to all prospects. Completed tasks are kept.</span></div>
        </CardContent>
      </Card>

      <div className="flex justify-end"><Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />} Save settings</Button></div>
    </form>
  );
}

function useBilling({ hasCustomer, active, plan }: { hasCustomer: boolean; active: boolean; plan: string }) {
  const { isDemo } = useAppMode();
  const [loading, setLoading] = useState<string | null>(null);
  const go = async (path: string, body?: object, key = path) => {
    if (isDemo) return toast.info(DEMO_TOAST);
    setLoading(key);
    try {
      const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Billing request failed");
      window.location.href = data.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Billing request failed");
      setLoading(null);
    }
  };
  const paidActive = active && plan !== "trial";
  return { go, loading, paidActive, hasCustomer };
}

export function PlanButton({ plan, current, active }: { plan: "starter" | "pro"; current: string; active: boolean }) {
  const b = useBilling({ hasCustomer: false, active, plan: current });
  const isCurrent = active && current === plan;
  if (isCurrent) return <Button variant="outline" disabled className="w-full">Current plan</Button>;
  if (b.paidActive) {
    return <Button variant="outline" className="w-full" disabled={!!b.loading} onClick={() => b.go("/api/stripe/portal", undefined, "portal")}>{b.loading && <Loader2 className="animate-spin" />} Switch in billing portal</Button>;
  }
  return (
    <Button className="w-full" variant={plan === "pro" ? "default" : "outline"} disabled={!!b.loading} onClick={() => b.go("/api/stripe/checkout", { plan }, plan)}>
      {b.loading === plan && <Loader2 className="animate-spin" />} Choose {plan === "pro" ? "Pro" : "Starter"}
    </Button>
  );
}

export function PortalButton({ disabled }: { disabled?: boolean }) {
  const b = useBilling({ hasCustomer: true, active: true, plan: "" });
  return (
    <Button variant="outline" disabled={disabled || !!b.loading} onClick={() => b.go("/api/stripe/portal", undefined, "portal")}>
      {b.loading && <Loader2 className="animate-spin" />} Manage billing
    </Button>
  );
}
