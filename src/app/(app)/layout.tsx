import { ShellLayout } from "@/views/shell-layout";
import { getLiveRepo } from "@/lib/data/live-repo";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  return <ShellLayout repo={await getLiveRepo()}>{children}</ShellLayout>;
}
