import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// ── Card ─────────────────────────────────────────────────────────────
export function Card({ className, ...p }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-xl border bg-card text-card-foreground shadow-[0_1px_2px_rgba(13,27,46,0.04)]", className)} {...p} />;
}
export function CardHeader({ className, ...p }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1 p-5 pb-3", className)} {...p} />;
}
export function CardTitle({ className, ...p }: React.ComponentProps<"h3">) {
  return <h3 className={cn("text-[15px] font-semibold leading-tight", className)} {...p} />;
}
export function CardDescription({ className, ...p }: React.ComponentProps<"p">) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...p} />;
}
export function CardContent({ className, ...p }: React.ComponentProps<"div">) {
  return <div className={cn("p-5 pt-0", className)} {...p} />;
}

// ── Form controls ───────────────────────────────────────────────────
const control =
  "w-full min-w-0 rounded-lg border border-input bg-card px-3 text-sm shadow-xs transition-colors placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive";

export function Input({ className, ...p }: React.ComponentProps<"input">) {
  return <input className={cn(control, "h-9 py-1", className)} {...p} />;
}
export function Textarea({ className, ...p }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-20 py-2", className)} {...p} />;
}
export function NativeSelect({ className, children, ...p }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        control,
        "h-9 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%235b6b82%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:14px] bg-[right_0.6rem_center] bg-no-repeat pr-8",
        className,
      )}
      {...p}
    >
      {children}
    </select>
  );
}
export function Label({ className, ...p }: React.ComponentProps<"label">) {
  return <label className={cn("text-[13px] font-medium leading-none text-foreground/90", className)} {...p} />;
}
export function Field({ label, htmlFor, error, hint, className, children }: { label: string; htmlFor?: string; error?: string[] | string; hint?: React.ReactNode; className?: string; children: React.ReactNode }) {
  const msg = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {msg ? <p className="text-xs text-destructive" role="alert">{msg}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

// ── Badge ────────────────────────────────────────────────────────────
export const badgeVariants = cva("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap [&_svg]:size-3", {
  variants: {
    variant: {
      default: "border-transparent bg-primary/10 text-primary",
      teal: "border-transparent bg-accent text-accent-foreground",
      outline: "text-muted-foreground",
      success: "border-transparent bg-success/12 text-success",
      warning: "border-transparent bg-warning/12 text-warning",
      danger: "border-transparent bg-destructive/12 text-destructive",
      muted: "border-transparent bg-muted text-muted-foreground",
    },
  },
  defaultVariants: { variant: "default" },
});
export function Badge({ className, variant, ...p }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...p} />;
}

// ── Table ────────────────────────────────────────────────────────────
export function Table({ className, ...p }: React.ComponentProps<"table">) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table className={cn("w-full caption-bottom text-sm", className)} {...p} />
    </div>
  );
}
export const THead = ({ className, ...p }: React.ComponentProps<"thead">) => <thead className={cn("[&_tr]:border-b", className)} {...p} />;
export const TBody = ({ className, ...p }: React.ComponentProps<"tbody">) => <tbody className={cn("[&_tr:last-child]:border-0", className)} {...p} />;
export const TR = ({ className, ...p }: React.ComponentProps<"tr">) => <tr className={cn("border-b transition-colors hover:bg-muted/50", className)} {...p} />;
export const TH = ({ className, ...p }: React.ComponentProps<"th">) => (
  <th className={cn("h-10 px-3 text-left align-middle text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap", className)} {...p} />
);
export const TD = ({ className, ...p }: React.ComponentProps<"td">) => <td className={cn("px-3 py-2.5 align-middle", className)} {...p} />;

// ── Misc ─────────────────────────────────────────────────────────────
export function Skeleton({ className, ...p }: React.ComponentProps<"div">) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...p} />;
}
export function Separator({ className }: { className?: string }) {
  return <div role="separator" className={cn("h-px w-full bg-border", className)} />;
}
export function Progress({ value, className, label }: { value: number; className?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${v}%` }} />
    </div>
  );
}
export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      {icon && <div className="mb-1 rounded-full bg-muted p-3 text-muted-foreground [&_svg]:size-5">{icon}</div>}
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
