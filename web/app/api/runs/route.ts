import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, serviceClient, userClient } from "@/lib/server";

const bodySchema = z.object({
  query: z.string().trim().min(2).max(120),
  domain: z.string().trim().max(253).optional(),
  force: z.boolean().optional(),
});

const CACHE_DAYS = 7;

function normalizeDomain(input: string | undefined): string | null {
  if (!input) return null;
  try {
    const s = input.trim().toLowerCase();
    return new URL(s.includes("://") ? s : `https://${s}`).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// Starts a run, or points at the last one if the company was researched in the past week.
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth) return NextResponse.json({ error: "sign in to start a run" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid request" }, { status: 400 });
  const { query, force } = parsed.data;
  const domain = normalizeDomain(parsed.data.domain);

  if (!force) {
    const service = serviceClient();
    const since = new Date(Date.now() - CACHE_DAYS * 86_400_000).toISOString();
    const lookup = domain
      ? service.from("companies").select("id").eq("domain", domain)
      : service.from("companies").select("id").ilike("name", query);
    const { data: companies } = await lookup.limit(1);
    if (companies?.[0]) {
      const { data: recent } = await service
        .from("research_runs")
        .select("id")
        .eq("company_id", companies[0].id)
        .eq("status", "done")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1);
      if (recent?.[0]) return NextResponse.json({ id: recent[0].id, cached: true });
    }
  }

  const { data, error } = await userClient(auth.token)
    .from("research_runs")
    .insert({ query, domain_hint: domain })
    .select("id")
    .single();
  if (error) {
    const limited = error.message.includes("rate limit");
    return NextResponse.json(
      { error: limited ? "5 runs per hour; try again later" : error.message },
      { status: limited ? 429 : 400 },
    );
  }
  return NextResponse.json({ id: data.id, cached: false });
}
