import { NextResponse } from "next/server";
import { requireUser, serviceClient } from "@/lib/server";

export const runtime = "nodejs";

// Deletes a finished run: its tasks and evidence go with it (cascade), and so do its replays,
// which are copies of it. Anyone signed in may delete their own runs and any replay.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if (!auth) return NextResponse.json({ error: "sign in first" }, { status: 401 });
  const { id } = await params;
  const db = serviceClient();

  const { data: run } = await db
    .from("research_runs")
    .select("id, status, requested_by, replay_of, company_id")
    .eq("id", id)
    .single();
  if (!run) return NextResponse.json({ error: "run not found" }, { status: 404 });
  if (run.requested_by !== auth.user.id && !run.replay_of) {
    return NextResponse.json({ error: "you can only delete your own runs" }, { status: 403 });
  }
  if (run.status !== "done" && run.status !== "failed") {
    return NextResponse.json({ error: "wait until the run has finished" }, { status: 409 });
  }

  const { data: replays } = await db.from("research_runs").select("id").eq("replay_of", id);
  const ids = [id, ...(replays ?? []).map((r) => r.id as string)];
  const del = await db.from("research_runs").delete().in("id", ids);
  if (del.error) return NextResponse.json({ error: del.error.message }, { status: 500 });
  await db.storage.from("reports").remove(ids.map((r) => `${r}.pdf`));

  // The company profile is the latest merge. If it came from a deleted run, rebuild it from
  // the newest run that is left, or drop the company when nothing is left.
  if (run.company_id) {
    const { data: profile } = await db
      .from("company_stack")
      .select("run_id")
      .eq("company_id", run.company_id)
      .limit(1);
    const stale = !profile?.length || ids.includes(profile[0]!.run_id as string);
    if (stale) {
      const { data: latest } = await db
        .from("research_runs")
        .select("id")
        .eq("company_id", run.company_id)
        .eq("status", "done")
        .order("created_at", { ascending: false })
        .limit(1);
      if (latest?.[0]) {
        await db
          .from("research_runs")
          .update({ status: "merging", merge_started_at: null })
          .eq("id", latest[0].id);
      } else {
        const { count } = await db
          .from("research_runs")
          .select("id", { count: "exact", head: true })
          .eq("company_id", run.company_id);
        if (!count) await db.from("companies").delete().eq("id", run.company_id);
      }
    }
  }
  return NextResponse.json({ deleted: ids.length });
}
