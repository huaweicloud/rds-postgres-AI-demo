import { z } from "zod";
import { cleanHtml } from "../../fetch/clean.js";

// Public job board APIs. Each board is one JSON request that returns every open posting
// with its description, so a board counts as a single page read.

export interface Posting {
  title: string;
  url: string;
  text: string;
  postedAt: string | null;
  board: "greenhouse" | "lever" | "ashby";
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function htmlToText(html: string): string {
  return cleanHtml(`<html><body>${html}</body></html>`).text;
}

function day(v: string | number | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

const greenhouseSchema = z.object({
  jobs: z.array(
    z.object({
      title: z.string(),
      absolute_url: z.string(),
      content: z.string().nullable().optional(),
      updated_at: z.string().nullable().optional(),
    }),
  ),
});

export function parseGreenhouse(data: unknown): Posting[] {
  return greenhouseSchema.parse(data).jobs.map((j) => ({
    title: j.title,
    url: j.absolute_url,
    // Greenhouse returns the description HTML entity-encoded.
    text: htmlToText(decodeEntities(j.content ?? "")),
    postedAt: day(j.updated_at),
    board: "greenhouse",
  }));
}

const leverSchema = z.array(
  z.object({
    text: z.string(),
    hostedUrl: z.string(),
    descriptionPlain: z.string().optional().default(""),
    additionalPlain: z.string().optional().default(""),
    lists: z
      .array(z.object({ text: z.string(), content: z.string() }))
      .optional()
      .default([]),
    createdAt: z.number().optional(),
  }),
);

export function parseLever(data: unknown): Posting[] {
  return leverSchema.parse(data).map((j) => ({
    title: j.text,
    url: j.hostedUrl,
    text: [
      j.descriptionPlain,
      ...j.lists.map((l) => `${l.text}\n${htmlToText(l.content)}`),
      j.additionalPlain,
    ]
      .filter(Boolean)
      .join("\n\n"),
    postedAt: day(j.createdAt),
    board: "lever",
  }));
}

const ashbySchema = z.object({
  jobs: z.array(
    z.object({
      title: z.string(),
      jobUrl: z.string(),
      descriptionPlain: z.string().optional(),
      descriptionHtml: z.string().optional(),
      publishedAt: z.string().optional(),
    }),
  ),
});

export function parseAshby(data: unknown): Posting[] {
  return ashbySchema.parse(data).jobs.map((j) => ({
    title: j.title,
    url: j.jobUrl,
    text: j.descriptionPlain ?? htmlToText(j.descriptionHtml ?? ""),
    postedAt: day(j.publishedAt),
    board: "ashby",
  }));
}

export interface BoardRef {
  board: Posting["board"];
  slug: string;
}

export const BOARD_API: Record<Posting["board"], (slug: string) => string> = {
  greenhouse: (s) =>
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(s)}/jobs?content=true`,
  lever: (s) => `https://api.lever.co/v0/postings/${encodeURIComponent(s)}?mode=json`,
  ashby: (s) => `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(s)}`,
};

export const BOARD_PARSER: Record<Posting["board"], (data: unknown) => Posting[]> = {
  greenhouse: parseGreenhouse,
  lever: parseLever,
  ashby: parseAshby,
};

// Board slugs to try, from the name and domain: "Acme Labs" + acme-labs.io →
// acmelabs, acme-labs, acme.
export function slugCandidates(name: string, domain: string | null): string[] {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(inc|llc|ltd|gmbh|corp|corporation|company|co)\b\.?/g, "")
    .trim();
  const words = base.split(/[^a-z0-9]+/).filter(Boolean);
  const label = domain?.split(".")[0] ?? "";
  const out = [words.join(""), words.join("-"), label, words[0] ?? ""];
  return [...new Set(out.filter((s) => s.length >= 2))].slice(0, 3);
}

// Links to a job board on a careers page name the board slug directly.
export function boardLinks(html: string): BoardRef[] {
  const found: BoardRef[] = [];
  const patterns: [Posting["board"], RegExp][] = [
    [
      "greenhouse",
      /(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_board(?:\/js)?\?for=)?([a-z0-9_-]+)/gi,
    ],
    ["lever", /jobs\.(?:eu\.)?lever\.co\/([a-z0-9_-]+)/gi],
    ["ashby", /jobs\.ashbyhq\.com\/([a-z0-9_.%-]+)/gi],
  ];
  for (const [board, re] of patterns) {
    for (const m of html.matchAll(re)) {
      const slug = decodeURIComponent(m[1]!);
      if (!["embed", "js", "v1", "api"].includes(slug.toLowerCase())) found.push({ board, slug });
    }
  }
  const seen = new Set<string>();
  return found.filter((b) => {
    const k = `${b.board}:${b.slug.toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const ENGINEERING =
  /engineer|developer|sre|devops|platform|infrastructure|architect|data|machine learning|\bml\b|security|backend|frontend|full[- ]?stack|mobile|cloud|reliability/i;

// The postings most likely to name the stack: engineering roles, varied titles.
export function pickPostings(postings: Posting[], limit: number): Posting[] {
  const eng = postings.filter((p) => ENGINEERING.test(p.title) && p.text.length > 300);
  const pool = eng.length ? eng : postings.filter((p) => p.text.length > 300);
  const seen = new Set<string>();
  const out: Posting[] = [];
  for (const p of pool) {
    const key = p.title
      .toLowerCase()
      .replace(/\b(senior|staff|principal|lead|junior|sr\.?|jr\.?|i{1,3}|iv)\b/g, "")
      .replace(/\W+/g, " ")
      .trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}
