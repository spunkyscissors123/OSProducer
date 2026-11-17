import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/primitives";
import { PageHeader } from "@/components/app/bits";
import { SettingsForm } from "@/components/app/settings-forms";
import type { ViewProps } from "./types";

export async function SettingsView({ repo }: ViewProps) {
  const [profile, settings] = await Promise.all([repo.getProfile(), repo.getSettings()]);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Settings" description="Your profile, commission defaults, and renewal outreach schedule." />
      {repo.mode === "demo" && (
        <Card className="mb-5 border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            Settings are read-only in the demo.
            <Button asChild size="sm"><Link href="/signup">Create your account</Link></Button>
          </CardContent>
        </Card>
      )}
      <SettingsForm profile={profile} settings={settings} />
      {repo.mode === "live" && (
        <Card className="mt-5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5 text-sm">
            <div>
              <p className="font-medium">Password & security</p>
              <p className="text-muted-foreground">Send yourself a secure password reset link.</p>
            </div>
            <Button asChild variant="outline"><Link href="/forgot-password">Reset password</Link></Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
