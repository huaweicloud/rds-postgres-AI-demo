import { NextResponse } from "next/server";
import { requireUser, serviceClient } from "@/lib/server";

// The demo safety net: a new run that re-streams a finished run's evidence with its timing.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if (!auth) return NextResponse.json({ error: "sign in first" }, { status: 401 });
  const { id } = await params;

  const service = serviceClient();
  const { data: source } = await service
    .from("research_runs")
    .select("id, query, domain_hint, status")
    .eq("id", id)
    .single();
  if (!source || source.status !== "done") {
    return NextResponse.json({ error: "only finished runs can be replayed" }, { status: 400 });
  }
  // Replays skip the per-user rate limit: they cost nothing upstream.
  const { data, error } = await service
    .from("research_runs")
    .insert({
      query: source.query,
      domain_hint: source.domain_hint,
      replay_of: source.id,
      requested_by: null,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
