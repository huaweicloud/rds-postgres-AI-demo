import { NextResponse } from "next/server";
import type { Agent } from "@stackdowser/db";
import { renderReport, type ReportTech } from "@/lib/report";
import { serviceClient } from "@/lib/server";

export const runtime = "nodejs";

const LINK_TTL_SECONDS = 7 * 24 * 60 * 60;

// Renders the run's profile to PDF, stores it in the private reports bucket and returns a
// signed link that can be shared for a week.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = serviceClient();

  const { data: run } = await db
    .from("research_runs")
    .select("id, status, company_id, companies(name, domain, description, summary)")
    .eq("id", id)
    .single();
  if (!run || run.status !== "done" || !run.company_id) {
    return NextResponse.json({ error: "the run hasn't finished" }, { status: 400 });
  }
  const company = run.companies as unknown as {
    name: string;
    domain: string | null;
    description: string | null;
    summary: string | null;
  };

  const { data: stack } = await db
    .from("company_stack")
    .select("score, status, agent_count, technology_id, technologies(name, category, slug)")
    .eq("company_id", run.company_id)
    .order("score", { ascending: false });
  const { data: evidence } = await db
    .from("evidence")
    .select("technology_id, agent, snippet, source_url, confidence")
    .eq("run_id", id)
    .order("confidence", { ascending: false });

  const technologies: ReportTech[] = (stack ?? []).map((row) => {
    const tech = row.technologies as unknown as { name: string; category: string; slug: string };
    return {
      name: tech.name,
      slug: tech.slug,
      category: tech.category,
      status: row.status,
      score: row.score,
      agentCount: row.agent_count,
      evidence: (evidence ?? [])
        .filter((e) => e.technology_id === row.technology_id)
        .map((e) => ({ agent: e.agent as Agent, snippet: e.snippet, source_url: e.source_url })),
    };
  });

  const pdf = await renderReport({
    company,
    generatedAt: new Date().toISOString().slice(0, 10),
    findings: evidence?.length ?? 0,
    sources: new Set((evidence ?? []).map((e) => e.source_url)).size,
    technologies,
  });
  const path = `${id}.pdf`;
  const upload = await db.storage
    .from("reports")
    .upload(path, pdf, { contentType: "application/pdf", upsert: true });
  // Without Storage there is no shareable link, but the report itself still works: send it
  // straight back and let the browser open it.
  if (upload.error) {
    console.error("report upload failed:", upload.error.message);
    return new NextResponse(new Uint8Array(pdf), {
      headers: { "content-type": "application/pdf", "x-report-stored": "false" },
    });
  }

  const signed = await db.storage.from("reports").createSignedUrl(path, LINK_TTL_SECONDS);
  if (signed.error) return NextResponse.json({ error: signed.error.message }, { status: 500 });
  // The signed URL points at the internal Supabase address; rewrite it to the public origin,
  // where the proxy forwards /storage.
  const url = new URL(signed.data.signedUrl);
  const origin = process.env.PUBLIC_SITE_URL ?? new URL(req.url).origin;
  return NextResponse.json({ url: `${origin}${url.pathname}${url.search}` });
}
