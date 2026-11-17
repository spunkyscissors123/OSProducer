import { Check, ShieldCheck } from "lucide-react";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Progress } from "@/components/ui/primitives";
import { PageHeader } from "@/components/app/bits";
import { PlanButton, PortalButton } from "@/components/app/settings-forms";
import { PLANS, formatPrice } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { sp, type ViewProps } from "./types";

export async function BillingView({ repo, searchParams }: ViewProps) {
  const [ent, usage] = await Promise.all([repo.getEntitlements(), repo.getAiUsageThisMonth()]);
  const checkout = sp(searchParams, "checkout");
  const testMode = !process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Billing" description="Manage your ProducerOS subscription." actions={repo.mode === "live" && ent.plan !== "trial" ? <PortalButton /> : undefined} />
      {checkout === "success" && <Card className="mb-5 border-success/40 bg-success/5"><CardContent className="p-4 text-sm">Thanks! Your subscription is being activated — it can take a few seconds for Stripe to confirm.</CardContent></Card>}
      {checkout === "canceled" && <Card className="mb-5"><CardContent className="p-4 text-sm text-muted-foreground">Checkout canceled. You have not been charged.</CardContent></Card>}

      <Card className="mb-5">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Current plan</p>
            <p className="mt-1 flex items-center gap-2 text-lg font-semibold">{ent.label} {ent.active ? <Badge variant="success">Active</Badge> : <Badge variant="danger">Inactive</Badge>}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">AI generations this month</p>
            <p className="mt-1 text-lg font-semibold tabular">{usage} / {ent.aiGenerationsPerMonth}</p>
            <Progress value={ent.aiGenerationsPerMonth ? (usage / ent.aiGenerationsPerMonth) * 100 : 0} className="mt-2" label="AI usage" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">CSV rows per import</p>
            <p className="mt-1 text-lg font-semibold tabular">{ent.csvRowsPerImport.toLocaleString()}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        {Object.values(PLANS).map((p) => (
          <Card key={p.id} className={cn("relative", p.id === "pro" && "border-primary shadow-lg shadow-primary/10")}>
            {p.id === "pro" && <Badge className="absolute right-4 top-4 bg-primary text-white">Most popular</Badge>}
            <CardHeader>
              <CardTitle className="text-lg">{p.name}</CardTitle>
              <CardDescription>{p.description}</CardDescription>
              <p className="mt-2"><span className="font-display text-4xl font-bold">{formatPrice(p.priceCents)}</span><span className="text-muted-foreground">/month</span></p>
            </CardHeader>
            <CardContent className="grid gap-4">
              <ul className="grid gap-2 text-sm">
                {p.highlights.map((h) => <li key={h} className="flex items-start gap-2"><Check className="mt-0.5 size-4 text-teal" /> {h}</li>)}
              </ul>
              <PlanButton plan={p.id} current={ent.plan} active={ent.active} />
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5" /> Payments are processed securely by Stripe. {testMode && <strong className="text-warning">Test mode — no real charges.</strong>}
      </p>
    </div>
  );
}
