import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

export interface CleanPage {
  title: string | null;
  text: string;
  publishedAt: string | null;
}

function isoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const year = d.getUTCFullYear();
  if (year < 1995 || year > new Date().getUTCFullYear() + 1) return null;
  return d.toISOString().slice(0, 10);
}

function findPublished(document: Document): string | null {
  const meta = [
    'meta[property="article:published_time"]',
    'meta[name="article:published_time"]',
    'meta[itemprop="datePublished"]',
    'meta[name="date"]',
    'meta[name="publish-date"]',
    'meta[property="og:published_time"]',
  ];
  for (const sel of meta) {
    const v = isoDate(document.querySelector(sel)?.getAttribute("content"));
    if (v) return v;
  }
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    const m = /"datePublished"\s*:\s*"([^"]+)"/.exec(script.textContent ?? "");
    const v = isoDate(m?.[1]);
    if (v) return v;
  }
  return isoDate(document.querySelector("time[datetime]")?.getAttribute("datetime"));
}

export function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

// Readable text for the extractor. Falls back to the whole body when Readability finds no
// article, which is common for careers pages and job boards.
export function cleanHtml(html: string): CleanPage {
  const { document } = parseHTML(html);
  const publishedAt = findPublished(document as unknown as Document);
  const titleTag = document.querySelector("title")?.textContent?.trim() || null;

  let text = "";
  let title = titleTag;
  try {
    const article = new Readability(document as unknown as Document, {
      charThreshold: 200,
    }).parse();
    if (article?.textContent) {
      text = article.textContent;
      title = article.title || titleTag;
    }
  } catch {
    // Readability throws on some malformed documents; the body fallback below covers it.
  }
  if (normalizeWhitespace(text).length < 200) {
    const { document: fresh } = parseHTML(html);
    for (const el of fresh.querySelectorAll("script, style, noscript, svg, nav, footer"))
      el.remove();
    text = fresh.body?.textContent ?? "";
  }

  return {
    title,
    text: text
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n+/g, "\n\n")
      .trim(),
    publishedAt,
  };
}
