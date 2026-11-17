"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Archive, ArchiveRestore, Handshake, KanbanSquare, Loader2, Mail, PhoneCall, Plus, StickyNote, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/overlay";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/primitives";
import { useAction, useAppMode } from "./mode";
import { addProspectToPipeline, createTask, logActivity, moveOpportunityStage, updateOpportunity } from "@/lib/actions/crm";
import { addContact, deleteContact, setProspectArchived } from "@/lib/actions/prospects";
import { PIPELINE_STAGES, type Contact, type Opportunity } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { calculateCommission } from "@/lib/domain/commission";

// ── Log activity ─────────────────────────────────────────────────────
const TYPES = [
  { id: "call", label: "Call", icon: PhoneCall },
  { id: "email", label: "Email", icon: Mail },
  { id: "meeting", label: "Meeting", icon: Handshake },
  { id: "note", label: "Note", icon: StickyNote },
] as const;

export function ActivityLogger({ prospectId }: { prospectId: string }) {
  const { run, pending } = useAction();
  const [type, setType] = useState<(typeof TYPES)[number]["id"]>("call");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        fd.set("type", type);
        fd.set("prospect_id", prospectId);
        run(() => logActivity(fd), { success: "Activity logged", onSuccess: () => form.reset(), onError: (r) => setErrors(r.fieldErrors ?? {}) });
      }}
    >
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Activity type">
        {TYPES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={type === id}
            onClick={() => setType(id)}
            className={cn("inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors", type === id ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")}
          >
            <Icon className="size-3.5" /> {label}
          </button>
        ))}
      </div>
      <Field label="Subject" htmlFor="act-subject" error={errors.subject}>
        <Input id="act-subject" name="subject" required maxLength={200} placeholder={type === "call" ? "Intro call — left voicemail" : type === "meeting" ? "Discovery meeting" : "Summary"} />
      </Field>
      <Field label="Details" htmlFor="act-body">
        <Textarea id="act-body" name="body" rows={3} maxLength={10000} placeholder="What happened? Next steps?" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="When" htmlFor="act-when" hint="Defaults to now">
          <Input id="act-when" name="occurred_at" type="datetime-local" />
        </Field>
        <Field label="Set next follow-up" htmlFor="act-follow">
          <Input id="act-follow" name="next_follow_up_date" type="date" />
        </Field>
      </div>
      <Button type="submit" disabled={pending} className="justify-self-end">{pending && <Loader2 className="animate-spin" />} Log {type}</Button>
    </form>
  );
}

// ── New task dialog ──────────────────────────────────────────────────
export function NewTaskDialog({ prospectId, prospects, defaultDate, trigger }: { prospectId?: string; prospects?: { id: string; business_name: string }[]; defaultDate: string; trigger?: React.ReactNode }) {
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button size="sm"><Plus /> New task</Button>}</DialogTrigger>
      <DialogContent title="New follow-up task">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            if (prospectId) fd.set("prospect_id", prospectId);
            run(() => createTask(fd), { success: "Task created", onSuccess: () => setOpen(false), onError: (r) => setErrors(r.fieldErrors ?? {}) });
          }}
        >
          <Field label="Title" htmlFor="task-title" error={errors.title}>
            <Input id="task-title" name="title" required maxLength={200} placeholder="Call to confirm renewal date" autoFocus />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Due date" htmlFor="task-due" error={errors.due_date}>
              <Input id="task-due" name="due_date" type="date" required defaultValue={defaultDate} />
            </Field>
            <Field label="Priority" htmlFor="task-priority">
              <NativeSelect id="task-priority" name="priority" defaultValue="medium">
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </NativeSelect>
            </Field>
          </div>
          {!prospectId && prospects && (
            <Field label="Linked prospect" htmlFor="task-prospect">
              <NativeSelect id="task-prospect" name="prospect_id" defaultValue="">
                <option value="">None</option>
                {prospects.map((p) => <option key={p.id} value={p.id}>{p.business_name}</option>)}
              </NativeSelect>
            </Field>
          )}
          <Field label="Notes" htmlFor="task-desc">
            <Textarea id="task-desc" name="description" rows={2} maxLength={2000} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>Create task</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Prospect header actions ──────────────────────────────────────────
export function ArchiveButton({ id, archived }: { id: string; archived: boolean }) {
  const { run, pending } = useAction();
  const router = useRouter();
  const { href } = useAppMode();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        if (!archived && !confirm("Archive this prospect? Open renewal tasks will be removed. You can restore it later.")) return;
        run(() => setProspectArchived(id, !archived), { success: archived ? "Prospect restored" : "Prospect archived", onSuccess: () => !archived && router.push(href("/prospects")) });
      }}
    >
      {archived ? <><ArchiveRestore /> Restore</> : <><Archive /> Archive</>}
    </Button>
  );
}

export function AddToPipelineButton({ prospectId, size = "default" }: { prospectId: string; size?: "default" | "sm" }) {
  const { run, pending } = useAction();
  return (
    <Button variant="outline" size={size} disabled={pending} onClick={() => run(() => addProspectToPipeline(prospectId), { success: "Added to pipeline" })}>
      <KanbanSquare /> Add to pipeline
    </Button>
  );
}

// ── Opportunity panel ────────────────────────────────────────────────
export function OpportunityPanel({ opp, rate, nbSplit, renewalSplit }: { opp: Opportunity; rate: number; nbSplit: number; renewalSplit: number }) {
  const { run, pending } = useAction();
  const [premium, setPremium] = useState(opp.estimated_premium?.toString() ?? "");
  const [prob, setProb] = useState(opp.close_probability);
  const calc = calculateCommission({ annualPremium: Number(premium) || 0, agencyCommissionRate: rate, newBusinessSplit: nbSplit, renewalSplit, closeProbability: prob });
  const dirty = premium !== (opp.estimated_premium?.toString() ?? "") || prob !== opp.close_probability;

  return (
    <div className="grid gap-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{opp.name}</p>
        <NativeSelect
          aria-label="Pipeline stage"
          className="h-8 w-auto text-xs"
          value={opp.stage}
          disabled={pending}
          onChange={(e) => {
            const s = e.target.value;
            const reason = s === "lost" ? prompt("Reason lost (optional)") ?? undefined : undefined;
            run(() => moveOpportunityStage(opp.id, s, reason), { success: "Stage updated" });
          }}
        >
          {PIPELINE_STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </NativeSelect>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Est. annual premium" htmlFor={`prem-${opp.id}`}>
          <Input id={`prem-${opp.id}`} inputMode="decimal" value={premium} onChange={(e) => setPremium(e.target.value.replace(/[^0-9.]/g, ""))} />
        </Field>
        <Field label={`Close probability: ${prob}%`} htmlFor={`prob-${opp.id}`}>
          <input id={`prob-${opp.id}`} type="range" min={0} max={100} step={5} value={prob} onChange={(e) => setProb(Number(e.target.value))} className="h-9 accent-[var(--primary)]" />
        </Field>
      </div>
      <dl className="grid grid-cols-3 gap-2 rounded-md bg-muted/60 p-2 text-center text-xs">
        <div><dt className="text-muted-foreground">Agency comm.</dt><dd className="font-semibold tabular">{formatCurrency(calc.agencyCommission)}</dd></div>
        <div><dt className="text-muted-foreground">Your NB comm.</dt><dd className="font-semibold tabular">{formatCurrency(calc.producerNewBusiness)}</dd></div>
        <div><dt className="text-muted-foreground">Weighted</dt><dd className="font-semibold tabular">{formatCurrency(calc.weightedProducerNewBusiness)}</dd></div>
      </dl>
      {dirty && (
        <Button
          size="sm"
          className="justify-self-end"
          disabled={pending}
          onClick={() => run(() => updateOpportunity(opp.id, { estimated_premium: premium === "" ? null : Number(premium), close_probability: prob, expected_close_date: opp.expected_close_date }), { success: "Opportunity saved" })}
        >
          Save
        </Button>
      )}
    </div>
  );
}

// ── Contacts ─────────────────────────────────────────────────────────
export function ContactsPanel({ prospectId, contacts }: { prospectId: string; contacts: Contact[] }) {
  const { run, pending } = useAction();
  const [adding, setAdding] = useState(false);
  return (
    <div className="grid gap-2">
      {contacts.map((c) => (
        <div key={c.id} className="flex items-start justify-between gap-2 rounded-lg border p-2.5 text-sm">
          <div className="min-w-0">
            <p className="font-medium">{c.name}{c.title && <span className="font-normal text-muted-foreground"> · {c.title}</span>}</p>
            <p className="truncate text-xs text-muted-foreground">{[c.email, c.phone].filter(Boolean).join(" · ") || "No contact details"}</p>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label={`Remove ${c.name}`} onClick={() => run(() => deleteContact(c.id, prospectId), { success: "Contact removed" })}><Trash2 /></Button>
        </div>
      ))}
      {adding ? (
        <form
          className="grid gap-2 rounded-lg border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("prospect_id", prospectId);
            run(() => addContact(fd), { success: "Contact added", onSuccess: () => setAdding(false) });
          }}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <Input name="name" placeholder="Name *" required aria-label="Name" />
            <Input name="title" placeholder="Title" aria-label="Title" />
            <Input name="email" type="email" placeholder="Email" aria-label="Email" />
            <Input name="phone" type="tel" placeholder="Phone" aria-label="Phone" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={pending}>Add contact</Button>
          </div>
        </form>
      ) : (
        <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => setAdding(true)}><UserPlus /> Add contact</Button>
      )}
    </div>
  );
}
