import { z } from "zod";
import type { Db } from "../db.js";
import { HttpError, withRetry } from "../net.js";

export interface SearchResult {
  url: string;
  title: string;
  content: string;
}

export interface SearchProvider {
  name: string;
  search(query: string, signal?: AbortSignal): Promise<SearchResult[]>;
}

const MAX_RESULTS = 8;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const searxngSchema = z.object({
  results: z.array(
    z.object({ url: z.string(), title: z.string().default(""), content: z.string().default("") }),
  ),
});

export function searxng(baseUrl: string): SearchProvider {
  return {
    name: "searxng",
    async search(query, signal) {
      const url = `${baseUrl.replace(/\/$/, "")}/search?q=${encodeURIComponent(query)}&format=json&language=en`;
      const res = await fetch(url, {
        signal: AbortSignal.any([AbortSignal.timeout(12_000), ...(signal ? [signal] : [])]),
      });
      if (!res.ok) throw new HttpError(res.status, url);
      return searxngSchema.parse(await res.json()).results.slice(0, MAX_RESULTS);
    },
  };
}

const tavilySchema = z.object({
  results: z.array(
    z.object({ url: z.string(), title: z.string().default(""), content: z.string().default("") }),
  ),
});

export function tavily(apiKey: string): SearchProvider {
  return {
    name: "tavily",
    async search(query, signal) {
      const url = "https://api.tavily.com/search";
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        // Basic depth costs one credit per search on the free tier.
        body: JSON.stringify({ query, search_depth: "basic", max_results: MAX_RESULTS }),
        signal: AbortSignal.any([AbortSignal.timeout(15_000), ...(signal ? [signal] : [])]),
      });
      if (!res.ok) throw new HttpError(res.status, url);
      return tavilySchema.parse(await res.json()).results;
    },
  };
}

// Tries each provider in order and moves on when one errors or returns nothing. Results are
// cached by query for 24 hours, so rehearsal re-runs don't hit the upstream engines again.
export class Search {
  constructor(
    private readonly db: Db,
    private readonly providers: SearchProvider[],
  ) {}

  get available(): boolean {
    return this.providers.length > 0;
  }

  async search(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
    const { data: cached } = await this.db
      .from("search_cache")
      .select("results, fetched_at")
      .eq("query", query)
      .maybeSingle();
    if (cached && Date.now() - new Date(cached.fetched_at).getTime() < CACHE_TTL_MS) {
      return cached.results as SearchResult[];
    }

    for (const provider of this.providers) {
      try {
        const results = await withRetry(() => provider.search(query, signal));
        if (results.length) {
          await this.db.from("search_cache").upsert({
            query,
            provider: provider.name,
            results,
            fetched_at: new Date().toISOString(),
          });
          return results;
        }
      } catch (err) {
        if (signal?.aborted) throw err;
      }
    }
    return [];
  }
}

export function createSearch(
  db: Db,
  opts: { providers: string; searxngUrl?: string | undefined; tavilyKey?: string | undefined },
): Search {
  const providers: SearchProvider[] = [];
  for (const name of opts.providers.split(",").map((s) => s.trim())) {
    if (name === "searxng" && opts.searxngUrl) providers.push(searxng(opts.searxngUrl));
    if (name === "tavily" && opts.tavilyKey) providers.push(tavily(opts.tavilyKey));
  }
  return new Search(db, providers);
}

// Startup check: SearXNG answers HTML or a 403 when JSON output isn't enabled in settings.yml.
export async function checkSearxng(baseUrl: string): Promise<void> {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/search?q=test&format=json`, {
    signal: AbortSignal.timeout(15_000),
  });
  const type = res.headers.get("content-type") ?? "";
  if (res.status === 403 || !type.includes("json")) {
    throw new Error(`SearXNG returned ${res.status} ${type}: enable json in search.formats`);
  }
}
