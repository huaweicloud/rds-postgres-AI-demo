import pLimit from "p-limit";
import { extractFromPage } from "../../extract/extract.js";
import { errorMessage } from "../../log.js";
import type { SearchResult } from "../../clients/search.js";
import { filterResults, planQueries, runSearches } from "../search-fallback.js";
import type { AgentContext, AgentFn } from "../types.js";
import {
  BOARD_API,
  BOARD_PARSER,
  boardLinks,
  pickPostings,
  slugCandidates,
  type BoardRef,
  type Posting,
} from "./ats.js";

const PAGE_CONCURRENCY = 12;

async function readBoard(ctx: AgentContext, ref: BoardRef): Promise<Posting[]> {
  try {
    const data = await ctx.services.fetcher.json<unknown>(
      BOARD_API[ref.board](ref.slug),
      ctx.signal,
    );
    const postings = BOARD_PARSER[ref.board](data);
    // A probe that finds nothing is free; a board that answers counts as one page read.
    if (postings.length) ctx.budget.take("pages");
    return postings;
  } catch {
    return [];
  }
}

async function boardsFromCareersPage(ctx: AgentContext): Promise<BoardRef[]> {
  const domain = ctx.target.domain;
  if (!domain) return [];
  for (const path of ["/careers", "/jobs"]) {
    if (!ctx.budget.tryTake("pages")) return [];
    try {
      const res = await ctx.services.fetcher.raw(`https://${domain}${path}`, {
        signal: ctx.signal,
      });
      if (res.status < 400) {
        const refs = boardLinks(res.body);
        if (refs.length) return refs;
      }
    } catch {
      // Try the next path.
    }
  }
  return [];
}

async function extractPostings(ctx: AgentContext, postings: Posting[]) {
  const limit = pLimit(PAGE_CONCURRENCY);
  await Promise.all(
    postings.map((p) =>
      limit(async () => {
        if (ctx.budget.remaining("llmCalls") === 0) return;
        try {
          const found = await extractFromPage(
            ctx,
            {
              url: p.url,
              title: p.title,
              text: p.text,
              publishedAt: p.postedAt,
              kind: "jobs",
            },
            1,
          );
          for (const e of found) await ctx.emit(e);
        } catch (err) {
          ctx.log.warn("extract failed", { url: p.url, error: errorMessage(err) });
        }
      }),
    ),
  );
}

// Search engines index postings the board probes can't reach: Workday, SmartRecruiters,
// regional job sites, the company's own careers pages. Fixed queries, so no LLM call.
function postingQueries(companyName: string, domain: string | null): string[] {
  return [
    `"${companyName}" software engineer job`,
    `"${companyName}" backend engineer careers`,
    ...(domain ? [`site:${domain} careers engineer`] : []),
  ];
}

// Pages found by search that the board APIs already gave us.
const BOARD_HOSTS = /(^|\.)(greenhouse\.io|lever\.co|ashbyhq\.com)$/;

// With postings from a board, search pages only add to them.
const SEARCH_PAGES_WITH_BOARDS = 2;

async function readSearchPages(ctx: AgentContext, keep: SearchResult[]) {
  if (!keep.length) return;
  await ctx.step(`reading ${keep.length} pages found by search`);
  const limit = pLimit(PAGE_CONCURRENCY);
  await Promise.all(
    keep.map((r) =>
      limit(async () => {
        if (!ctx.budget.tryTake("pages")) return;
        try {
          const page = await ctx.services.fetcher.page(r.url, ctx.signal);
          const found = await extractFromPage(ctx, { ...page, kind: "jobs" }, 1);
          for (const e of found) await ctx.emit(e);
        } catch (err) {
          ctx.log.warn("page skipped", { url: r.url, error: errorMessage(err) });
        }
      }),
    ),
  );
}

export const jobsAgent: AgentFn = async (ctx) => {
  const { companyName, domain } = ctx.target;
  if (!ctx.services.llm.available) {
    await ctx.step("skipped: no LLM configured");
    return;
  }

  // Board slugs on the three public ATS APIs and the search engines, all in parallel.
  const searched = runSearches(ctx, postingQueries(companyName, domain));
  const slugs = slugCandidates(companyName, domain);
  await ctx.step(`job boards: ${slugs.join(", ")} on Greenhouse, Lever, Ashby`);
  const probes = slugs.flatMap((slug) =>
    (["greenhouse", "lever", "ashby"] as const).map((board) => ({ board, slug })),
  );
  let postings = (await Promise.all(probes.map((ref) => readBoard(ctx, ref)))).flat();

  if (!postings.length) {
    await ctx.step(`careers page on ${domain}`);
    const refs = await boardsFromCareersPage(ctx);
    postings = (await Promise.all(refs.slice(0, 2).map((ref) => readBoard(ctx, ref)))).flat();
  }

  let results = await searched;
  if (postings.length) {
    results = results.filter((r) => {
      try {
        return !BOARD_HOSTS.test(new URL(r.url).hostname);
      } catch {
        return false;
      }
    });
  } else {
    // No board: let the LLM plan a few more queries with what's left of the search budget.
    const planned = await planQueries(ctx, "public job postings for software engineering roles", [
      `site:boards.greenhouse.io ${companyName}`,
      `site:jobs.lever.co ${companyName}`,
      `site:jobs.ashbyhq.com ${companyName}`,
    ]);
    const seen = new Set(results.map((r) => r.url));
    results.push(...(await runSearches(ctx, planned)).filter((r) => !seen.has(r.url)));
  }

  const keep = await filterResults(
    ctx,
    results,
    "job postings for technical roles",
    postings.length
      ? Math.min(SEARCH_PAGES_WITH_BOARDS, ctx.budget.remaining("pages"))
      : ctx.budget.remaining("pages"),
  );

  if (postings.length) {
    // Leave one LLM call for each search page.
    const budget = Math.max(0, ctx.budget.remaining("llmCalls") - keep.length);
    const picked = pickPostings(postings, Math.min(7, budget));
    await ctx.step(`reading ${picked.length} of ${postings.length} postings`);
    await extractPostings(ctx, picked);
  }
  await readSearchPages(ctx, keep);
};
