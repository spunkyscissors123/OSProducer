import Link from "next/link";
import { ArrowRight, BellRing, CalendarClock, Calculator, Kanban, ShieldCheck, Sparkles, Telescope } from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  { icon: CalendarClock, title: "Renewal intelligence", body: "See every account renewing in 30, 60, 90 and 120 days. Outreach tasks schedule themselves — and unknown dates stay unknown." },
  { icon: Kanban, title: "Visual sales pipeline", body: "Drag opportunities from first touch to bound. Premium and commission roll up at every stage." },
  { icon: Sparkles, title: "AI outreach that doesn't make things up", body: "Draft intro emails, call scripts and discovery questions from the facts you've recorded. You review, edit and send." },
  { icon: Telescope, title: "Prospect Finder", body: "Slice your book and imported lists by niche, industry, location and size. Clear labels for verified, entered and unknown data." },
  { icon: Calculator, title: "Commission forecasting", body: "Transparent formulas for agency commission, your split, renewals, and probability-weighted production." },
  { icon: BellRing, title: "Daily prospecting plan", body: "Open ProducerOS and know exactly which businesses need you today — and which follow-ups slipped." },
];

export default function Landing() {
  return (
    <main>
      <section className="relative overflow-hidden bg-sidebar text-white">
        <div className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(60%_60%_at_80%_0%,rgba(45,212,191,0.22),transparent_60%),radial-gradient(50%_50%_at_10%_20%,rgba(59,130,246,0.25),transparent_60%)]" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-24">
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-700">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-teal">Built for commercial P&C producers</p>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Prospect smarter.<br /><span className="bg-gradient-to-r from-blue-400 to-teal bg-clip-text text-transparent">Produce more.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-sidebar-foreground">ProducerOS is the prospecting CRM that organizes your targets around what actually wins commercial accounts: renewal timing, disciplined follow-up, and sharp outreach.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" variant="teal"><Link href="/signup">Start 14-day free trial <ArrowRight /></Link></Button>
              <Button asChild size="lg" variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10"><Link href="/demo/dashboard">Explore the live demo</Link></Button>
            </div>
            <p className="mt-4 text-xs text-sidebar-muted">No credit card required for the trial.</p>
          </div>
          <div className="relative hidden lg:block" aria-hidden>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl backdrop-blur">
              <div className="grid grid-cols-3 gap-3">
                {[["Premium pipeline", "$1.9M"], ["Renewing ≤ 60d", "9"], ["Closed YTD", "$302K"]].map(([l, v]) => (
                  <div key={l} className="rounded-xl bg-white/[0.06] p-3"><p className="text-[11px] text-sidebar-muted">{l}</p><p className="mt-1 font-display text-xl font-bold">{v}</p></div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {["Contacted", "Meeting", "Quoting", "Proposal"].map((s, i) => (
                  <div key={s} className="rounded-lg bg-white/[0.05] p-2">
                    <p className="text-[10px] font-semibold text-sidebar-foreground">{s}</p>
                    {Array.from({ length: 3 - (i % 2) }).map((_, j) => (
                      <div key={j} className="mt-2 rounded-md bg-white/[0.08] p-2"><div className="h-1.5 w-3/4 rounded bg-white/30" /><div className="mt-1.5 h-1.5 w-1/2 rounded bg-teal/60" /></div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="max-w-2xl text-3xl font-bold tracking-tight">Everything a producer needs to build a book — nothing they don&apos;t.</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border bg-card p-6 transition-all hover:-translate-y-0.5 hover:shadow-lg">
              <span className="inline-flex rounded-lg bg-primary/10 p-2 text-primary"><Icon className="size-5" /></span>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y bg-card">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-[1fr_auto] md:items-center">
          <div className="flex gap-4">
            <ShieldCheck className="size-8 shrink-0 text-teal" />
            <div>
              <h2 className="text-xl font-bold">Your book stays yours.</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Row-level security isolates every producer&apos;s data. We never sell your prospects, never scrape restricted sites, and never fabricate business records.</p>
            </div>
          </div>
          <Button asChild size="lg"><Link href="/signup">Get started</Link></Button>
        </div>
      </section>
    </main>
  );
}
