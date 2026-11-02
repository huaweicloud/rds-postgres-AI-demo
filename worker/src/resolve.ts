import type { ResearchRun } from "@stackdowser/db";
import { Resolver } from "node:dns/promises";
import { z } from "zod";
import { must, type Db } from "./db.js";
import { errorMessage, type Logger } from "./log.js";
import type { Services } from "./services.js";

const resolvedSchema = z.object({
  name: z.string().min(1).max(120),
  domain: z.string().min(3).max(253),
  description: z.string().max(300).nullable().default(null),
});

const SYSTEM = `You identify companies for a research tool.
Given what the user typed, return json: {"name": "...", "domain": "...", "description": "..."}.
- name: the company's usual name.
- domain: its primary website domain, without scheme, path or "www." (for example "stripe.com").
- description: one plain sentence on what the company does, or null if you don't know it.
If a domain hint is given, it is correct; use it.`;

export function normalizeDomain(input: string): string | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  try {
    const host = new URL(s.includes("://") ? s : `https://${s}`).hostname.replace(/^www\./, "");
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? host : null;
  } catch {
    return null;
  }
}

async function domainExists(domain: string): Promise<boolean> {
  const r = new Resolver({ timeout: 2_500, tries: 2 });
  const found = await Promise.all([
    r.resolve4(domain).then(
      (a) => a.length > 0,
      () => false,
    ),
    r.resolveNs(domain).then(
      (a) => a.length > 0,
      () => false,
    ),
  ]);
  return found.some(Boolean);
}

export interface Resolved {
  name: string;
  domain: string;
  description: string | null;
}

export async function resolveCompany(run: ResearchRun, services: Services): Promise<Resolved> {
  const hint = run.domain_hint ? normalizeDomain(run.domain_hint) : normalizeDomain(run.query);
  const looksLikeDomain = !run.domain_hint && hint !== null && run.query.includes(".");

  if (services.llm.available) {
    const user = `Company: ${run.query}${run.domain_hint ? `\nDomain hint: ${run.domain_hint}` : ""}`;
    const r = await services.llm.json({
      system: SYSTEM,
      user,
      schema: resolvedSchema,
      maxTokens: 300,
    });
    const domain = (run.domain_hint ? hint : normalizeDomain(r.domain)) ?? hint;
    if (domain && (await domainExists(domain)))
      return { name: r.name, domain, description: r.description };
  }

  // Without an LLM: trust a domain the user gave, else try the obvious .com.
  const guess =
    hint && (run.domain_hint || looksLikeDomain)
      ? hint
      : normalizeDomain(`${run.query.replace(/[^a-z0-9]/gi, "")}.com`);
  if (guess && (await domainExists(guess))) {
    return {
      name: looksLikeDomain ? guess.split(".")[0]! : run.query.trim(),
      domain: guess,
      description: null,
    };
  }
  throw new Error(`could not find a domain for "${run.query}"; add one as a hint`);
}

// Resolves a claimed run, records the company and moves the run to researching, which fans
// out the agent tasks (trigger in 0003).
export async function handleResolve(run: ResearchRun, db: Db, services: Services, log: Logger) {
  try {
    const r = await resolveCompany(run, services);
    const company = must(
      await db
        .from("companies")
        .upsert(
          {
            name: r.name,
            domain: r.domain,
            description: r.description,
            logo_url: `https://icons.duckduckgo.com/ip3/${r.domain}.ico`,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "domain" },
        )
        .select("id")
        .single(),
    ) as { id: string };
    must(
      await db
        .from("research_runs")
        .update({ company_id: company.id, status: "researching" })
        .eq("id", run.id)
        .eq("status", "resolving"),
    );
    log.info("run resolved", { run: run.id, domain: r.domain });
  } catch (err) {
    log.warn("resolve failed", { run: run.id, error: errorMessage(err) });
    await db
      .from("research_runs")
      .update({
        status: "failed",
        error: errorMessage(err).slice(0, 300),
        finished_at: new Date().toISOString(),
      })
      .eq("id", run.id);
  }
}
