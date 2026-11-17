import Link from "next/link";
import { AppShell } from "@/components/app/shell";
import type { Repo } from "@/lib/data/repo";

export async function ShellLayout({ repo, children }: { repo: Repo; children: React.ReactNode }) {
  const [profile, ent, tasks] = await Promise.all([repo.getProfile(), repo.getEntitlements(), repo.listTasks()]);
  const overdue = tasks.filter((t) => t.status === "open" && t.due_date < repo.todayIso).length;

  let banner: React.ReactNode = null;
  if (repo.mode === "demo") {
    banner = (
      <div className="border-b bg-gradient-to-r from-primary/10 via-teal/10 to-transparent px-4 py-2 text-center text-[13px] sm:px-6">
        You&apos;re exploring a demo with <strong>entirely fictional</strong> businesses. Nothing here is saved.{" "}
        <Link href="/signup" className="font-semibold text-primary hover:underline">Start your free trial →</Link>
      </div>
    );
  } else if (!ent.active) {
    banner = (
      <div className="border-b bg-warning/10 px-4 py-2 text-center text-[13px] sm:px-6">
        Your {ent.plan === "trial" ? "trial has ended" : "subscription is inactive"}. Your data is safe — AI and imports are paused.{" "}
        <Link href="/billing" className="font-semibold text-primary hover:underline">Choose a plan →</Link>
      </div>
    );
  }

  return (
    <AppShell
      mode={repo.mode}
      basePath={repo.basePath}
      user={{ name: profile.full_name, email: profile.email, agency: profile.agency_name }}
      planLabel={ent.label}
      overdueCount={overdue}
      banner={banner}
    >
      {children}
    </AppShell>
  );
}
