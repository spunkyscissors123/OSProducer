import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLANS, formatPrice } from "@/lib/plans";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Pricing" };

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <div className="text-center">
        <h1 className="text-4xl font-extrabold tracking-tight">Simple pricing for serious producers</h1>
        <p className="mt-3 text-muted-foreground">Start with a 14-day free trial. Cancel anytime.</p>
      </div>
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {Object.values(PLANS).map((p) => (
          <div key={p.id} className={cn("relative rounded-2xl border bg-card p-7", p.id === "pro" && "border-primary shadow-xl shadow-primary/10")}>
            {p.id === "pro" && <span className="absolute -top-3 left-7 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">Most popular</span>}
            <h2 className="text-xl font-bold">{p.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
            <p className="mt-5"><span className="font-display text-5xl font-extrabold">{formatPrice(p.priceCents)}</span><span className="text-muted-foreground">/month</span></p>
            <ul className="mt-6 grid gap-2.5 text-sm">
              {p.highlights.map((h) => <li key={h} className="flex items-start gap-2"><Check className="mt-0.5 size-4 text-teal" /> {h}</li>)}
            </ul>
            <Button asChild className="mt-7 w-full" size="lg" variant={p.id === "pro" ? "default" : "outline"}><Link href={`/signup?plan=${p.id}`}>Start free trial</Link></Button>
          </div>
        ))}
      </div>
      <p className="mt-8 text-center text-xs text-muted-foreground">Prices in USD. Taxes may apply. AI generation limits reset monthly.</p>
    </main>
  );
}
