"use client";
import { createContext, useCallback, useContext, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/types";

interface ModeCtx {
  mode: "live" | "demo";
  basePath: "" | "/demo";
}
const Ctx = createContext<ModeCtx>({ mode: "live", basePath: "" });

export function AppModeProvider({ mode, basePath, children }: ModeCtx & { children: React.ReactNode }) {
  return <Ctx.Provider value={{ mode, basePath }}>{children}</Ctx.Provider>;
}

export function useAppMode() {
  const ctx = useContext(Ctx);
  const href = useCallback((path: string) => `${ctx.basePath}${path}`, [ctx.basePath]);
  return { ...ctx, isDemo: ctx.mode === "demo", href };
}

export const DEMO_TOAST = "Demo mode — changes aren't saved. Create a free account to use ProducerOS with your own data.";

/**
 * Runs a server action with consistent UX: pending state, error toasts, success toast, refresh.
 * In demo mode it never calls the server — it explains that demo data is read-only.
 */
export function useAction() {
  const { isDemo } = useAppMode();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = useCallback(
    <T,>(fn: () => Promise<ActionResult<T>>, opts: { success?: string; onSuccess?: (r: ActionResult<T> & { ok: true }) => void; onError?: (r: ActionResult<T> & { ok: false }) => void } = {}) => {
      if (isDemo) {
        toast.info(DEMO_TOAST);
        return;
      }
      startTransition(async () => {
        try {
          const r = await fn();
          if (r.ok) {
            if (opts.success) toast.success(opts.success);
            opts.onSuccess?.(r as ActionResult<T> & { ok: true });
            router.refresh();
          } else {
            toast.error(r.error);
            opts.onError?.(r as ActionResult<T> & { ok: false });
          }
        } catch {
          toast.error("Network error — please try again.");
        }
      });
    },
    [isDemo, router],
  );
  return { run, pending, isDemo };
}
