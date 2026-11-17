"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent, type Announcements,
} from "@dnd-kit/core";
import { ArrowRightLeft, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/overlay";
import { useAction, useAppMode } from "./mode";
import { moveOpportunityStage } from "@/lib/actions/crm";
import { producerCommission } from "@/lib/domain/commission";
import { diffDays } from "@/lib/domain/dates";
import { PIPELINE_STAGES, stageLabel, type OpportunityWithProspect, type PipelineStage } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";

const ACCENT: Record<PipelineStage, string> = {
  new_prospect: "bg-slate-400", researching: "bg-indigo-400", contacted: "bg-sky-500", meeting_scheduled: "bg-blue-500",
  discovery_completed: "bg-cyan-500", quoting: "bg-teal-500", proposal_presented: "bg-violet-500", won: "bg-emerald-500", lost: "bg-rose-400",
};

export function PipelineBoard({ opportunities, rate, split, todayIso }: { opportunities: OpportunityWithProspect[]; rate: number; split: number; todayIso: string }) {
  const [items, setItems] = useState(opportunities);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { run, isDemo } = useAction();
  useEffect(() => setItems(opportunities), [opportunities]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const byStage = useMemo(() => {
    const m = new Map<PipelineStage, OpportunityWithProspect[]>(PIPELINE_STAGES.map((s) => [s.id, []]));
    for (const o of items) m.get(o.stage)?.push(o);
    return m;
  }, [items]);

  const move = (id: string, stage: PipelineStage) => {
    const opp = items.find((o) => o.id === id);
    if (!opp || opp.stage === stage) return;
    const reason = stage === "lost" && !isDemo ? prompt(`Why was ${opp.prospect.business_name} lost? (optional)`) ?? undefined : undefined;
    const previous = items;
    // Optimistic UI (also used in demo mode so the board stays interactive — nothing is saved there).
    setItems((cur) => cur.map((o) => (o.id === id ? { ...o, stage } : o)));
    if (isDemo) return;
    run(() => moveOpportunityStage(id, stage, reason), { success: `Moved to ${stageLabel(stage)}`, onError: () => setItems(previous) });
  };

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (e.over) move(String(e.active.id), e.over.id as PipelineStage);
  };

  const name = (id: string | number) => items.find((o) => o.id === id)?.prospect.business_name ?? "opportunity";
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${name(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${name(active.id)} is over ${stageLabel(over.id as PipelineStage)}.` : `${name(active.id)} is not over a stage.`),
    onDragEnd: ({ active, over }) => (over ? `${name(active.id)} moved to ${stageLabel(over.id as PipelineStage)}.` : `${name(active.id)} was dropped.`),
    onDragCancel: ({ active }) => `Moving ${name(active.id)} cancelled.`,
  };
  const active = items.find((o) => o.id === activeId);

  return (
    <>
      {isDemo && <p className="mb-3 text-xs text-muted-foreground">Demo: drag cards to try the board — changes reset on reload.</p>}
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)} accessibility={{ announcements, screenReaderInstructions: { draggable: "Press space to pick up a card, use arrow keys to move between stages, space to drop. Or use the Move menu on each card." } }}>
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
          {PIPELINE_STAGES.map((s) => (
            <Column key={s.id} stage={s.id} items={byStage.get(s.id) ?? []} rate={rate} split={split} todayIso={todayIso} onMove={move} />
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>{active ? <CardBody opp={active} rate={rate} split={split} todayIso={todayIso} dragging /> : null}</DragOverlay>
      </DndContext>
    </>
  );
}

function Column({ stage, items, rate, split, todayIso, onMove }: { stage: PipelineStage; items: OpportunityWithProspect[]; rate: number; split: number; todayIso: string; onMove: (id: string, s: PipelineStage) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const premium = items.reduce((s, o) => s + (o.estimated_premium ?? 0), 0);
  return (
    <section
      ref={setNodeRef}
      aria-label={`${stageLabel(stage)} — ${items.length} opportunities`}
      className={cn("flex w-[82vw] max-w-[290px] shrink-0 snap-start flex-col rounded-xl border bg-muted/40 transition-colors sm:w-[272px]", isOver && "border-primary bg-primary/5 ring-2 ring-primary/20")}
    >
      <header className="sticky top-0 border-b px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", ACCENT[stage])} aria-hidden />
          <h2 className="text-[13px] font-semibold">{stageLabel(stage)}</h2>
          <span className="ml-auto rounded-md bg-card px-1.5 text-xs font-medium text-muted-foreground tabular">{items.length}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground tabular">
          {formatCurrency(premium, { compact: true })} premium · {formatCurrency(producerCommission(premium, rate, split), { compact: true })} comm.
        </p>
      </header>
      <ul className="flex min-h-24 flex-1 flex-col gap-2 p-2">
        {items.map((o) => <DraggableCard key={o.id} opp={o} rate={rate} split={split} todayIso={todayIso} onMove={onMove} />)}
        {items.length === 0 && <li className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">Drop here</li>}
      </ul>
    </section>
  );
}

function DraggableCard({ opp, rate, split, todayIso, onMove }: { opp: OpportunityWithProspect; rate: number; split: number; todayIso: string; onMove: (id: string, s: PipelineStage) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: opp.id });
  return (
    <li ref={setNodeRef} className={cn(isDragging && "opacity-40")}>
      <CardBody opp={opp} rate={rate} split={split} todayIso={todayIso} handle={{ ...attributes, ...listeners }} onMove={onMove} />
    </li>
  );
}

function CardBody({ opp, rate, split, todayIso, handle, onMove, dragging }: { opp: OpportunityWithProspect; rate: number; split: number; todayIso: string; handle?: Record<string, unknown>; onMove?: (id: string, s: PipelineStage) => void; dragging?: boolean }) {
  const { href } = useAppMode();
  const renewal = opp.prospect.renewal_date ? diffDays(todayIso, opp.prospect.renewal_date) : null;
  return (
    <div className={cn("group rounded-lg border bg-card p-3 shadow-xs transition-shadow hover:shadow-md", dragging && "rotate-2 shadow-xl ring-2 ring-primary/30")}>
      <div className="flex items-start gap-1.5">
        <button {...handle} className="-ml-1 mt-0.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground/60 hover:bg-muted hover:text-foreground active:cursor-grabbing" aria-label={`Drag ${opp.prospect.business_name}`}>
          <GripVertical className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <Link href={href(`/prospects/${opp.prospect_id}`)} className="line-clamp-2 text-[13px] font-semibold leading-snug hover:text-primary">{opp.prospect.business_name}</Link>
          <p className="truncate text-[11px] text-muted-foreground">{opp.prospect.industry ?? "—"}{opp.prospect.state ? ` · ${opp.prospect.state}` : ""}</p>
        </div>
        {onMove && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="-mr-1 -mt-1 size-7" aria-label={`Move ${opp.prospect.business_name} to another stage`}>
                <ArrowRightLeft className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="max-h-80 overflow-y-auto">
              <DropdownMenuLabel>Move to…</DropdownMenuLabel>
              {PIPELINE_STAGES.filter((s) => s.id !== opp.stage).map((s) => (
                <DropdownMenuItem key={s.id} onSelect={() => onMove(opp.id, s.id)}>
                  <span className={cn("size-2 rounded-full", ACCENT[s.id])} /> {s.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div className="mt-2.5 flex items-end justify-between gap-2">
        <div>
          <p className="text-[13px] font-bold tabular">{formatCurrency(opp.estimated_premium)}</p>
          <p className="text-[11px] text-muted-foreground tabular">≈ {formatCurrency(producerCommission(opp.estimated_premium, rate, split))} comm.</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-medium text-muted-foreground tabular">{opp.close_probability}%</p>
          {renewal !== null && renewal >= 0 && (
            <p className={cn("text-[11px] font-medium tabular", renewal <= 30 ? "text-destructive" : renewal <= 60 ? "text-warning" : "text-muted-foreground")}>
              Renews {renewal}d{opp.prospect.renewal_date_status === "estimated" ? " (est.)" : ""}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
