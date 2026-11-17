import { NextResponse } from "next/server";
import { audit, AuthError, getUserOrThrow } from "@/lib/auth";
import { prospectsToCsv, EXPORT_COLUMNS } from "@/lib/domain/csv";
import { rateLimit } from "@/lib/rate-limit";

/** Exports only the signed-in user's own prospects (RLS + explicit user filter). */
export async function GET(req: Request) {
  try {
    const { supabase, user } = await getUserOrThrow();
    if (!rateLimit(`export:${user.id}`, 20, 60 * 60 * 1000).ok) return NextResponse.json({ error: "Too many exports." }, { status: 429 });
    const includeArchived = new URL(req.url).searchParams.get("archived") === "1";
    let q = supabase.from("prospects").select(EXPORT_COLUMNS.join(",")).eq("user_id", user.id).order("business_name").limit(20000);
    if (!includeArchived) q = q.is("archived_at", null);
    const { data, error } = await q;
    if (error) throw error;
    await audit(supabase, user.id, "prospect.export", { type: "prospect" }, { rows: data?.length ?? 0 });
    const csv = prospectsToCsv((data ?? []) as unknown as Record<string, unknown>[]);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="producer-os-prospects-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    console.error("[export]", e);
    return NextResponse.json({ error: "Export failed." }, { status: 500 });
  }
}
