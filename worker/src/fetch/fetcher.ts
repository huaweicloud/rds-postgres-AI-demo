import type { Db } from "../db.js";
import { HttpError, withRetry } from "../net.js";
import { cleanHtml, type CleanPage } from "./clean.js";
import { isAllowed, parseRobots } from "./robots.js";

const MAX_BYTES = 3_000_000;
// Job board APIs return every posting with its full text: Datadog's Greenhouse board is 5 MB.
const MAX_JSON_BYTES = 16_000_000;
const ROBOTS_TTL_MS = 60 * 60 * 1000;
const PAGE_TTL_MS = 24 * 60 * 60 * 1000;
const LOGIN_PATH = /\/(login|signin|sign-in|sso|auth)(\/|$|\?)/i;

export interface Page extends CleanPage {
  url: string;
  status: number;
  fromCache: boolean;
}

export interface RawResponse {
  url: string;
  status: number;
  headers: Headers;
  body: string;
}

export class SkippedPage extends Error {}

export class Fetcher {
  private robots = new Map<string, { rules: ReturnType<typeof parseRobots>; at: number }>();

  constructor(
    private readonly db: Db,
    private readonly userAgent: string,
  ) {}

  // Whether robots.txt lets us read this URL; lets callers drop search results up front.
  async allows(url: string, signal?: AbortSignal): Promise<boolean> {
    try {
      return await this.allowedByRobots(new URL(url), signal);
    } catch {
      return false;
    }
  }

  private async allowedByRobots(url: URL, signal?: AbortSignal): Promise<boolean> {
    const cached = this.robots.get(url.origin);
    if (cached && Date.now() - cached.at < ROBOTS_TTL_MS) {
      return isAllowed(cached.rules, url.pathname + url.search);
    }
    let rules: ReturnType<typeof parseRobots> = [];
    try {
      const res = await fetch(`${url.origin}/robots.txt`, {
        headers: { "user-agent": this.userAgent },
        signal: AbortSignal.any([AbortSignal.timeout(5_000), ...(signal ? [signal] : [])]),
      });
      // A missing robots.txt means everything is allowed.
      if (res.ok) rules = parseRobots((await res.text()).slice(0, 200_000), this.userAgent);
    } catch {
      // Unreachable robots.txt: treat like a missing one rather than failing the page.
    }
    this.robots.set(url.origin, { rules, at: Date.now() });
    return isAllowed(rules, url.pathname + url.search);
  }

  // Reads the body with a size cap, so one huge page can't stall an agent.
  private async readCapped(res: Response, maxBytes = MAX_BYTES): Promise<string> {
    const reader = res.body?.getReader();
    if (!reader) return "";
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      chunks.push(value);
      if (total > maxBytes) {
        await reader.cancel();
        break;
      }
    }
    return new TextDecoder().decode(Buffer.concat(chunks));
  }

  async raw(
    url: string,
    opts: { signal?: AbortSignal; accept?: string; checkRobots?: boolean; maxBytes?: number } = {},
  ): Promise<RawResponse> {
    const parsed = new URL(url);
    if (opts.checkRobots !== false && !(await this.allowedByRobots(parsed, opts.signal))) {
      throw new SkippedPage(`robots.txt disallows ${url}`);
    }
    return withRetry(async () => {
      const res = await fetch(url, {
        headers: {
          "user-agent": this.userAgent,
          accept: opts.accept ?? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5",
          "accept-language": "en",
        },
        redirect: "follow",
        signal: AbortSignal.any([
          AbortSignal.timeout(12_000),
          ...(opts.signal ? [opts.signal] : []),
        ]),
      });
      if (res.status >= 500 || res.status === 429) throw new HttpError(res.status, url);
      return {
        url: res.url || url,
        status: res.status,
        headers: res.headers,
        body: await this.readCapped(res, opts.maxBytes),
      };
    });
  }

  async json<T>(url: string, signal?: AbortSignal): Promise<T> {
    const res = await this.raw(url, {
      signal,
      accept: "application/json",
      maxBytes: MAX_JSON_BYTES,
    });
    if (res.status >= 400) throw new HttpError(res.status, url);
    return JSON.parse(res.body) as T;
  }

  // A cleaned, readable page, cached by URL for 24 hours so rehearsal re-runs are cheap.
  async page(url: string, signal?: AbortSignal): Promise<Page> {
    const { data: cached } = await this.db
      .from("page_cache")
      .select("status, content_text, title, published_at, fetched_at")
      .eq("url", url)
      .maybeSingle();
    if (cached && Date.now() - new Date(cached.fetched_at).getTime() < PAGE_TTL_MS) {
      if (cached.status >= 400 || !cached.content_text)
        throw new SkippedPage(`cached ${cached.status}`);
      return {
        url,
        status: cached.status,
        text: cached.content_text,
        title: cached.title,
        publishedAt: cached.published_at,
        fromCache: true,
      };
    }

    const res = await this.raw(url, { signal });
    const finalUrl = new URL(res.url);
    const needsLogin =
      res.status === 401 ||
      res.status === 403 ||
      (LOGIN_PATH.test(finalUrl.pathname) && !LOGIN_PATH.test(new URL(url).pathname));
    const type = res.headers.get("content-type") ?? "";
    const readable = /html|xml|text\/plain/.test(type);
    const clean = res.status < 400 && !needsLogin && readable ? cleanHtml(res.body) : null;

    await this.db.from("page_cache").upsert({
      url,
      status: needsLogin ? 401 : res.status,
      content_text: clean?.text ?? null,
      title: clean?.title ?? null,
      published_at: clean?.publishedAt ?? null,
      fetched_at: new Date().toISOString(),
    });

    if (needsLogin) throw new SkippedPage(`login required: ${url}`);
    if (!clean) throw new SkippedPage(`unreadable (${res.status}, ${type}): ${url}`);
    return { url, status: res.status, ...clean, fromCache: false };
  }
}
