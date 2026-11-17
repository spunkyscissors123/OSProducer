import type { Metadata } from "next";
import { ShellLayout } from "@/views/shell-layout";
import { getDemoRepo } from "@/lib/data/demo-repo";

export const metadata: Metadata = { title: "Demo", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function DemoLayout({ children }: { children: React.ReactNode }) {
  return <ShellLayout repo={await getDemoRepo()}>{children}</ShellLayout>;
}
