"use client";
import Link from "next/link";
import { useState } from "react";
import { CalendarClock, Check, MoreHorizontal, RefreshCw, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlay";
import { Input } from "@/components/ui/primitives";
import { PriorityBadge } from "./bits";
import { useAction, useAppMode } from "./mode";
import { deleteTask, rescheduleTask, setTaskCompleted } from "@/lib/actions/crm";
import { addDays, diffDays, formatDate, relativeDays } from "@/lib/domain/dates";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";

export function TaskList({ tasks, todayIso, showProspect = true, compact = false, emptyText = "Nothing here." }: { tasks: Task[]; todayIso: string; showProspect?: boolean; compact?: boolean; emptyText?: string }) {
  const [rescheduling, setRescheduling] = useState<Task | null>(null);
  if (!tasks.length) return <p className="px-1 py-6 text-center text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <>
      <ul className="divide-y">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} todayIso={todayIso} showProspect={showProspect} compact={compact} onReschedule={() => setRescheduling(t)} />
        ))}
      </ul>
      <RescheduleDialog task={rescheduling} todayIso={todayIso} onClose={() => setRescheduling(null)} />
    </>
  );
}

function TaskRow({ task: t, todayIso, showProspect, compact, onReschedule }: { task: Task; todayIso: string; showProspect: boolean; compact: boolean; onReschedule: () => void }) {
  const { run, pending } = useAction();
  const { href } = useAppMode();
  const [optimisticDone, setOptimisticDone] = useState<boolean | null>(null);
  const done = optimisticDone ?? t.status === "completed";
  const days = diffDays(todayIso, t.due_date);
  const overdue = !done && days < 0;

  const toggle = () => {
    setOptimisticDone(!done);
    run(() => setTaskCompleted(t.id, !done), { success: !done ? "Task completed" : "Task reopened", onError: () => setOptimisticDone(null) });
  };

  return (
    <li className={cn("flex items-start gap-3 py-2.5", pending && "opacity-60")}>
      <button
        onClick={toggle}
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Mark "${t.title}" as not done` : `Mark "${t.title}" as done`}
        className={cn(
          "mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition-colors",
          done ? "border-success bg-success text-white" : "border-input hover:border-primary",
        )}
      >
        {done && <Check className="size-3" strokeWidth={3} />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium leading-snug", done && "text-muted-foreground line-through")}>{t.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className={cn("inline-flex items-center gap-1 tabular", overdue && "font-medium text-destructive")}>
            <CalendarClock className="size-3.5" />
            {formatDate(t.due_date, { month: "short", day: "numeric" })} · {overdue ? `${Math.abs(days)}d overdue` : relativeDays(days)}
          </span>
          {!compact && <PriorityBadge priority={t.priority} />}
          {t.source === "renewal" && <span className="inline-flex items-center gap-1 text-teal"><RefreshCw className="size-3" /> Renewal</span>}
          {showProspect && t.prospect_id && t.prospect?.business_name && (
            <Link href={href(`/prospects/${t.prospect_id}`)} className="truncate font-medium text-foreground/80 hover:text-primary hover:underline">
              {t.prospect.business_name}
            </Link>
          )}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Task actions for "${t.title}"`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={toggle}>{done ? <><Undo2 /> Reopen</> : <><Check /> Mark complete</>}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => run(() => rescheduleTask(t.id, addDays(todayIso, 1)), { success: "Moved to tomorrow" })}><CalendarClock /> Tomorrow</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => run(() => rescheduleTask(t.id, addDays(todayIso, 7)), { success: "Moved to next week" })}><CalendarClock /> Next week</DropdownMenuItem>
          <DropdownMenuItem onSelect={onReschedule}><CalendarClock /> Pick a date…</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive" onSelect={() => run(() => deleteTask(t.id), { success: "Task deleted" })}><Trash2 /> Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function RescheduleDialog({ task, todayIso, onClose }: { task: Task | null; todayIso: string; onClose: () => void }) {
  const { run, pending } = useAction();
  const [date, setDate] = useState("");
  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      {task && (
        <DialogContent title="Reschedule task" description={task.title}>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!date) return;
              run(() => rescheduleTask(task.id, date), { success: "Task rescheduled", onSuccess: onClose });
            }}
          >
            <Input type="date" required min={todayIso} defaultValue={task.due_date} onChange={(e) => setDate(e.target.value)} aria-label="New due date" />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={pending}>Save</Button>
            </div>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}
