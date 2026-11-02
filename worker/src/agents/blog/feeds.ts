// Just enough RSS, Atom and sitemap parsing to list posts with their dates.

export interface FeedItem {
  url: string;
  title: string;
  publishedAt: string | null;
}

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function tag(block: string, name: string): string | null {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i").exec(block);
  return m ? decode(m[1]!) : null;
}

function day(v: string | null): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function parseFeed(xml: string, baseUrl: string): FeedItem[] {
  const items: FeedItem[] = [];
  for (const m of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)) {
    const block = m[0];
    const link = tag(block, "link");
    if (!link) continue;
    items.push({
      url: new URL(link, baseUrl).toString(),
      title: tag(block, "title") ?? "",
      publishedAt: day(tag(block, "pubDate") ?? tag(block, "dc:date")),
    });
  }
  for (const m of xml.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi)) {
    const block = m[0];
    const href =
      /<link[^>]+rel=["']alternate["'][^>]*href=["']([^"']+)/i.exec(block)?.[1] ??
      /<link[^>]*href=["']([^"']+)/i.exec(block)?.[1];
    if (!href) continue;
    items.push({
      url: new URL(decode(href), baseUrl).toString(),
      title: tag(block, "title") ?? "",
      publishedAt: day(tag(block, "published") ?? tag(block, "updated")),
    });
  }
  return items;
}

export function parseSitemap(xml: string): { urls: FeedItem[]; sitemaps: string[] } {
  const urls: FeedItem[] = [];
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)) {
    const loc = tag(m[1]!, "loc");
    if (loc) urls.push({ url: loc, title: "", publishedAt: day(tag(m[1]!, "lastmod")) });
  }
  const sitemaps = [...xml.matchAll(/<sitemap>([\s\S]*?)<\/sitemap>/gi)]
    .map((m) => tag(m[1]!, "loc"))
    .filter((x): x is string => Boolean(x));
  return { urls, sitemaps };
}

// <link rel="alternate" type="application/rss+xml" href="..."> on the blog's front page.
export function feedLinks(html: string, baseUrl: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const t = m[0];
    if (!/rel=["']?alternate/i.test(t) || !/(rss|atom)\+xml/i.test(t)) continue;
    const href = /href=["']([^"']+)/i.exec(t)?.[1];
    if (href) out.push(new URL(decode(href), baseUrl).toString());
  }
  return [...new Set(out)];
}

const ENGINEERING_WORDS =
  /architect|migrat|scal|infrastructure|platform|database|postgres|mysql|kafka|kubernetes|k8s|cloud|aws|gcp|azure|pipeline|microservice|monolith|latency|performance|how we|built|rewrite|observab|search|data|machine learning|ml|reliab|outage|deploy|ci\/cd|terraform|rust|go\b|python|java|typescript/i;

// Newest first, with posts whose titles sound like architecture write-ups pulled forward.
export function rankPosts(items: FeedItem[], limit: number): FeedItem[] {
  const seen = new Set<string>();
  const unique = items.filter((i) => {
    if (seen.has(i.url)) return false;
    seen.add(i.url);
    return true;
  });
  const score = (i: FeedItem) => {
    const ageDays = i.publishedAt
      ? (Date.now() - new Date(i.publishedAt).getTime()) / 86_400_000
      : 1500;
    const recency = Math.max(0, 1 - ageDays / 1500);
    const topical = ENGINEERING_WORDS.test(i.title + " " + i.url) ? 1 : 0;
    return topical * 1.5 + recency;
  };
  return unique.sort((a, b) => score(b) - score(a)).slice(0, limit);
}
