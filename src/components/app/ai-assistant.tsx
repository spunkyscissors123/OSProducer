"use client";
import { useState } from "react";
import { Check, Copy, Info, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Field, NativeSelect, Progress, Textarea } from "@/components/ui/primitives";
import { useAppMode } from "./mode";
import { AI_KIND_META } from "@/lib/domain/ai-prompts";
import { AI_KINDS, AI_TONES } from "@/lib/validations";
import { INDUSTRIES } from "@/lib/types";
import { cn } from "@/lib/utils";

type Kind = (typeof AI_KINDS)[number];
type Tone = (typeof AI_TONES)[number];

export function AiAssistant({
  prospects, initialProspect, initialKind, usage, limit, history,
}: {
  prospects: { id: string; business_name: string }[];
  initialProspect?: string;
  initialKind?: Kind;
  usage: number;
  limit: number;
  history: { id: string; kind: string; output: string; created_at: string }[];
}) {
  const { isDemo } = useAppMode();
  const [kind, setKind] = useState<Kind>(initialKind && AI_KINDS.includes(initialKind) ? initialKind : "intro_email");
  const [tone, setTone] = useState<Tone>("professional");
  const [prospectId, setProspectId] = useState(initialProspect && prospects.some((p) => p.id === initialProspect) ? initialProspect : prospects[0]?.id ?? "");
  const [industry, setIndustry] = useState<string>("Construction");
  const [instructions, setInstructions] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [used, setUsed] = useState(usage);
  const meta = AI_KIND_META[kind];

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, tone, prospect_id: meta.needsProspect ? prospectId : null, industry: meta.needsProspect ? undefined : industry, instructions: instructions || undefined, demo: isDemo }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Generation failed");
        return;
      }
      setOutput(data.output);
      if (!isDemo) setUsed((u) => u + 1);
    } catch {
      toast.error("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
      <Card className="content-start">
        <CardHeader>
          <CardTitle>What do you need?</CardTitle>
          <CardDescription>Drafts use only the facts saved on the prospect.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Message type">
            {AI_KINDS.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
                className={cn("rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-colors", kind === k ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")}
              >
                {AI_KIND_META[k].label}
              </button>
            ))}
          </div>
          {meta.needsProspect ? (
            <Field label="Prospect" htmlFor="ai-prospect">
              <NativeSelect id="ai-prospect" value={prospectId} onChange={(e) => setProspectId(e.target.value)}>
                {prospects.length === 0 && <option value="">Add a prospect first</option>}
                {prospects.map((p) => <option key={p.id} value={p.id}>{p.business_name}</option>)}
              </NativeSelect>
            </Field>
          ) : (
            <Field label="Industry" htmlFor="ai-industry">
              <NativeSelect id="ai-industry" value={industry} onChange={(e) => setIndustry(e.target.value)}>
                {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
              </NativeSelect>
            </Field>
          )}
          <div className="grid gap-1.5">
            <span className="text-[13px] font-medium">Tone</span>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tone">
              {AI_TONES.map((t) => (
                <button key={t} type="button" role="radio" aria-checked={tone === t} onClick={() => setTone(t)}
                  className={cn("rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors", tone === t ? "border-teal bg-accent text-accent-foreground" : "hover:bg-muted")}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <Field label="Extra instructions (optional)" htmlFor="ai-instr">
            <Textarea id="ai-instr" rows={3} maxLength={1000} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="e.g. Mention we met at the chamber breakfast" />
          </Field>
          <Button variant="teal" size="lg" disabled={loading || (meta.needsProspect && !prospectId)} onClick={generate}>
            {loading ? <Loader2 className="animate-spin" /> : <Sparkles />} Generate {meta.label.toLowerCase()}
          </Button>
          {!isDemo && (
            <div className="grid gap-1.5">
              <div className="flex justify-between text-xs text-muted-foreground"><span>AI generations this month</span><span className="tabular">{used} / {limit}</span></div>
              <Progress value={limit ? (used / limit) * 100 : 100} label="AI usage this month" />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid content-start gap-5">
        <Card className="min-h-[420px]">
          <CardHeader className="flex-row items-start justify-between gap-2">
            <div>
              <CardTitle>Draft</CardTitle>
              <CardDescription>Edit freely. Nothing is sent automatically — copy it into your email or CRM.</CardDescription>
            </div>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" disabled={!output || loading} onClick={generate}><RotateCcw /> Regenerate</Button>
              <Button size="sm" disabled={!output} onClick={copy}>{copied ? <Check /> : <Copy />} Copy</Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading && !output ? (
              <div className="grid gap-2" aria-busy="true" aria-label="Generating">
                {[90, 75, 95, 60, 85, 40].map((w, i) => <div key={i} className="h-4 animate-pulse rounded bg-muted" style={{ width: `${w}%` }} />)}
              </div>
            ) : (
              <Textarea
                value={output}
                onChange={(e) => setOutput(e.target.value)}
                rows={18}
                className="min-h-[340px] font-[450] leading-relaxed"
                placeholder="Your draft will appear here."
                aria-label="Generated draft"
              />
            )}
            <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              AI drafts can contain mistakes. Review before sending. The assistant is instructed never to invent facts about a prospect, coverage, carriers, or renewal dates — unknowns appear as [placeholders].
            </p>
          </CardContent>
        </Card>

        {history.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Recent generations</CardTitle></CardHeader>
            <CardContent>
              <ul className="divide-y">
                {history.map((g) => (
                  <li key={g.id} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-xs font-medium">{AI_KIND_META[g.kind as Kind]?.label ?? g.kind} · <span className="text-muted-foreground" suppressHydrationWarning>{new Date(g.created_at).toLocaleString()}</span></p>
                      <p className="line-clamp-2 text-sm text-muted-foreground">{g.output}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setOutput(g.output)}>Open</Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
