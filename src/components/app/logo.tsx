import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" rx="8" fill="#13294b" />
      <path d="M9 23V9h7.5a4.5 4.5 0 0 1 0 9H13" fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="22.5" cy="22.5" r="2.5" fill="#2dd4bf" />
    </svg>
  );
}

export function Logo({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className={cn("font-display text-[17px] font-bold tracking-tight", tone === "light" ? "text-white" : "text-foreground")}>
        Producer<span className="text-teal">OS</span>
      </span>
    </span>
  );
}
