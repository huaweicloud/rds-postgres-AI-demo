import pLimit from "p-limit";
import { extractFromPage } from "../../extract/extract.js";
import { errorMessage } from "../../log.js";
import { filterResults, planQueries, runSearches } from "../search-fallback.js";
import type { AgentContext, AgentFn } from "../types.js";
import { feedLinks, parseFeed, parseSitemap, rankPosts, type FeedItem } from "./feeds.js";

const PAGE_CONCURRENCY = 12;

export function blogCandidates(domain: string): string[] {
  return [
    `https://engineering.${domain}/`,
    `https://${domain}/blog/`,
    `https://${domain}/engineering/`,
    `https://tech.${domain}/`,
  ];
}

// Probes the usual blog locations in parallel and returns the first that has posts.
async function findBlogPosts(
  ctx: AgentContext,
  domain: string,
): Promise<{ base: string; posts: FeedItem[] } | null> {
  const probes = await Promise.all(
    blogCandidates(domain).map(async (base) => {
      if (!ctx.budget.tryTake("pages")) return null;
      try {
        const res = await ctx.services.fetcher.raw(base, { signal: ctx.signal });
        if (res.status >= 400) return null;
        // A redirect to the company homepage means there's no blog here.
        const wanted = new URL(base);
        const final = new URL(res.url);
        const toHomepage =
          final.pathname === "/" &&
          (wanted.pathname !== "/" || final.hostname.replace(/^www\./, "") === domain);
        return toHomepage ? null : { base: res.url, html: res.body };
      } catch {
        return null;
      }
    }),
  );

  for (const probe of probes) {
    if (!probe) continue;
    for (const feed of [
      ...feedLinks(probe.html, probe.base),
      new URL("feed", probe.base).toString(),
    ].slice(0, 2)) {
      if (!ctx.budget.tryTake("pages")) break;
      try {
        const res = await ctx.services.fetcher.raw(feed, {
          signal: ctx.signal,
          accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
        });
        const items = res.status < 400 ? parseFeed(res.body, res.url) : [];
        if (items.length) return { base: probe.base, posts: items };
      } catch {
        // Try the sitemap next.
      }
    }
    if (ctx.budget.tryTake("pages")) {
      try {
        const res = await ctx.services.fetcher.raw(new URL("/sitemap.xml", probe.base).toString(), {
          signal: ctx.signal,
        });
        const prefix = new URL(probe.base);
        const posts = parseSitemap(res.body).urls.filter((u) => {
          const url = new URL(u.url);
          return (
            url.hostname === prefix.hostname &&
            url.pathname.startsWith(prefix.pathname) &&
            url.pathname.length > prefix.pathname.length + 3
          );
        });
        if (posts.length) return { base: probe.base, posts };
      } catch {
        // No sitemap either.
      }
    }
  }
  return null;
}

async function readAndExtract(
  ctx: AgentContext,
  urls: { url: string; publishedAt: string | null }[],
) {
  const limit = pLimit(PAGE_CONCURRENCY);
  await Promise.all(
    urls.map((item) =>
      limit(async () => {
        if (ctx.budget.remaining("llmCalls") === 0 || !ctx.budget.tryTake("pages")) return;
        try {
          const page = await ctx.services.fetcher.page(item.url, ctx.signal);
          const found = await extractFromPage(
            ctx,
            { ...page, publishedAt: page.publishedAt ?? item.publishedAt, kind: "blog" },
            1,
          );
          for (const e of found) await ctx.emit(e);
        } catch (err) {
          ctx.log.warn("post skipped", { url: item.url, error: errorMessage(err) });
        }
      }),
    ),
  );
}

export const blogAgent: AgentFn = async (ctx) => {
  const { companyName, domain } = ctx.target;
  if (!ctx.services.llm.available) {
    await ctx.step("skipped: no LLM configured");
    return;
  }

  let found: Awaited<ReturnType<typeof findBlogPosts>> = null;
  if (domain) {
    await ctx.step(`looking for a blog on ${domain}`);
    found = await findBlogPosts(ctx, domain);
  }

  // Keep two LLM calls back for the search fallback (plan and filter).
  const extractBudget = Math.max(0, ctx.budget.remaining("llmCalls") - 2);
  if (found) {
    const posts = rankPosts(found.posts, Math.min(extractBudget, ctx.budget.remaining("pages")));
    await ctx.step(`reading ${posts.length} posts from ${new URL(found.base).host}`);
    await readAndExtract(ctx, posts);
  }

  // Posts hosted elsewhere (Medium, conference sites), or no blog at all.
  if (ctx.budget.remaining("pages") > 0 && ctx.budget.remaining("llmCalls") > 1) {
    const queries = await planQueries(
      ctx,
      "engineering blog posts and conference talks about their architecture",
      [
        `${companyName} engineering blog`,
        `${companyName} "how we built"`,
        `${companyName} "migrated to"`,
        `${companyName} conference talk architecture`,
      ],
    );
    const results = await runSearches(
      ctx,
      found ? queries.filter((q) => !q.includes("site:")) : queries,
    );
    const keep = await filterResults(
      ctx,
      results.filter((r) => !found || !r.url.startsWith(found.base)),
      "engineering blog posts or talks by the company's own engineers",
      Math.min(ctx.budget.remaining("pages"), ctx.budget.remaining("llmCalls")),
    );
    await ctx.step(`reading ${keep.length} posts found by search`);
    await readAndExtract(
      ctx,
      keep.map((r) => ({ url: r.url, publishedAt: null })),
    );
  }
};
