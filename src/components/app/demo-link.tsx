"use client";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DEMO_TOAST, useAppMode } from "./mode";

/** Link to a live-only endpoint (e.g. CSV export). In demo mode it explains instead of navigating. */
export function DemoAwareLink({ href, className, children, download }: { href: string; className?: string; children: React.ReactNode; download?: boolean }) {
  const { isDemo } = useAppMode();
  return (
    <a
      href={href}
      download={download}
      className={cn(buttonVariants({ variant: "outline" }), className)}
      onClick={(e) => {
        if (isDemo) {
          e.preventDefault();
          toast.info(DEMO_TOAST);
        }
      }}
    >
      {children}
    </a>
  );
}
