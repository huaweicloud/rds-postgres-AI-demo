import { z } from "zod";
import type { SearchResult } from "../clients/search.js";
import type { AgentContext } from "./types.js";

// Shared by the Jobs and Blog agents: queries (fixed, or planned by the LLM) run in parallel,
// and one more LLM call picks the results worth reading.

const MAX_SEARCHES_PER_CALL = 3;

const planSchema = z.object({ queries: z.array(z.string().min(2).max(200)).min(1).max(5) });
const filterSchema = z.object({ keep: z.array(z.number().int().min(0)) });

export async function planQueries(
  ctx: AgentContext,
  purpose: string,
  examples: string[],
): Promise<string[]> {
  const { companyName, domain } = ctx.target;
  if (!ctx.services.llm.available || ctx.budget.remaining("llmCalls") < 2) return examples;
  try {
    const r = await ctx.services.llm.json(
      {
        system: `You write web search queries. Return json: {"queries": ["...", "..."]} with 3 to 5 queries.`,
        user: `Find ${purpose} for the company ${companyName} (${domain ?? "domain unknown"}).
Example queries: ${examples.join(" | ")}
Tailor them to this company; site: filters are allowed.`,
        schema: planSchema,
        maxTokens: 300,
        signal: ctx.signal,
      },
      () => ctx.budget.take("llmCalls"),
    );
    return r.queries;
  } catch {
    return examples;
  }
}

export async function runSearches(ctx: AgentContext, queries: string[]): Promise<SearchResult[]> {
  if (!ctx.services.search.available) return [];
  const picked = queries.slice(
    0,
    Math.min(MAX_SEARCHES_PER_CALL, ctx.budget.remaining("searches")),
  );
  await ctx.step(`searching: ${picked.join(" · ")}`);
  const batches = await Promise.all(
    picked.map(async (q) => {
      if (!ctx.budget.tryTake("searches")) return [];
      return ctx.services.search.search(q, ctx.signal).catch(() => []);
    }),
  );
  const seen = new Set<string>();
  const unique = batches.flat().filter((r) => {
    const key = r.url.replace(/[#?].*$/, "").replace(/\/$/, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // Job sites like LinkedIn disallow crawlers; drop them before the LLM picks what to read.
  const allowed = await Promise.all(
    unique.map((r) => ctx.services.fetcher.allows(r.url, ctx.signal)),
  );
  return unique.filter((_, i) => allowed[i]);
}

// Which results are actually about this company and worth a page read.
export async function filterResults(
  ctx: AgentContext,
  results: SearchResult[],
  purpose: string,
  limit: number,
): Promise<SearchResult[]> {
  if (!results.length) return [];
  if (!ctx.services.llm.available || ctx.budget.remaining("llmCalls") < 2)
    return results.slice(0, limit);
  const list = results
    .slice(0, 24)
    .map((r, i) => `${i}. ${r.title}\n   ${r.url}\n   ${r.content.slice(0, 200)}`)
    .join("\n");
  try {
    const r = await ctx.services.llm.json(
      {
        system: `You pick search results for a research tool. Return json: {"keep": [indexes]}, best first.`,
        user: `Company: ${ctx.target.companyName} (${ctx.target.domain ?? "domain unknown"})
Keep only results that are ${purpose} of this company (not a different company with a similar name). At most ${limit}.

${list}`,
        schema: filterSchema,
        maxTokens: 200,
        signal: ctx.signal,
      },
      () => ctx.budget.take("llmCalls"),
    );
    return r.keep
      .map((i) => results[i])
      .filter((x): x is SearchResult => Boolean(x))
      .slice(0, limit);
  } catch {
    return results.slice(0, limit);
  }
}
