import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { feedLinks, parseFeed, parseSitemap, rankPosts } from "../src/agents/blog/feeds.js";
import {
  boardLinks,
  parseAshby,
  parseGreenhouse,
  parseLever,
  pickPostings,
  slugCandidates,
} from "../src/agents/jobs/ats.js";
import { chunkText, extractionSchema, snippetInText } from "../src/extract/extract.js";
import { isAllowed, parseRobots } from "../src/fetch/robots.js";

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));

describe("ATS parsers (recorded responses)", () => {
  it("reads Greenhouse jobs and decodes the entity-encoded HTML", () => {
    const jobs = parseGreenhouse(fixture("greenhouse.json"));
    expect(jobs).toHaveLength(2);
    expect(jobs[0]!.url).toMatch(/^https:\/\//);
    expect(jobs[0]!.text.length).toBeGreaterThan(300);
    expect(jobs[0]!.text).not.toMatch(/&lt;|<p>/);
    expect(jobs[0]!.postedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("reads Lever postings with their lists", () => {
    const jobs = parseLever(fixture("lever.json"));
    expect(jobs).toHaveLength(2);
    expect(jobs[0]!.url).toContain("lever.co");
    expect(jobs[0]!.text.length).toBeGreaterThan(300);
  });

  it("reads Ashby postings", () => {
    const jobs = parseAshby(fixture("ashby.json"));
    expect(jobs).toHaveLength(2);
    expect(jobs[0]!.url).toContain("ashbyhq.com");
    expect(jobs[0]!.text.length).toBeGreaterThan(300);
  });

  it("finds board slugs in careers pages", () => {
    const html = `<a href="https://boards.greenhouse.io/acme/jobs/123">Jobs</a>
      <script src="https://boards.greenhouse.io/embed/job_board/js?for=acmeinc"></script>
      <a href="https://jobs.lever.co/acme-labs">Lever</a> <a href="https://jobs.ashbyhq.com/Acme%20Co">Ashby</a>`;
    expect(boardLinks(html)).toEqual([
      { board: "greenhouse", slug: "acme" },
      { board: "greenhouse", slug: "acmeinc" },
      { board: "lever", slug: "acme-labs" },
      { board: "ashby", slug: "Acme Co" },
    ]);
  });

  it("guesses slugs from the name and domain", () => {
    expect(slugCandidates("Acme Labs, Inc.", "acmelabs.io")).toEqual([
      "acmelabs",
      "acme-labs",
      "acme",
    ]);
    expect(slugCandidates("Stripe", "stripe.com")).toEqual(["stripe"]);
  });

  it("prefers distinct engineering postings", () => {
    const p = (title: string) => ({
      title,
      url: title,
      text: "x".repeat(400),
      postedAt: null,
      board: "lever" as const,
    });
    const picked = pickPostings(
      [
        p("Senior Backend Engineer"),
        p("Backend Engineer"),
        p("Account Executive"),
        p("Data Engineer"),
      ],
      5,
    );
    expect(picked.map((x) => x.title)).toEqual(["Senior Backend Engineer", "Data Engineer"]);
  });
});

describe("verbatim check", () => {
  const page = `We run   our order pipeline on Kafka.\nEvents land in “ClickHouse” within seconds — usually.`;

  it("accepts snippets that appear in the page, ignoring whitespace, case and quote style", () => {
    expect(snippetInText("we run our order pipeline on kafka.", page)).toBe(true);
    expect(snippetInText('Events land in "ClickHouse" within seconds - usually.', page)).toBe(true);
  });

  it("rejects invented or paraphrased snippets", () => {
    expect(snippetInText("We run our order pipeline on Pulsar.", page)).toBe(false);
    expect(snippetInText("Kafka", page)).toBe(false);
  });
});

describe("extraction schema", () => {
  it("accepts the spec's example and tolerates an unknown category", () => {
    const r = extractionSchema.parse({
      is_about_company: true,
      published_at: "2025-11-04",
      technologies: [
        {
          name: "Apache Kafka",
          category: "streaming",
          usage: "in_use",
          confidence: 0.9,
          snippet: "x",
        },
      ],
    });
    expect(r.technologies[0]!.category).toBeNull();
  });

  it("splits long pages at paragraph breaks", () => {
    const text = Array.from({ length: 10 }, (_, i) => `para ${i} ${"word ".repeat(100)}`).join(
      "\n\n",
    );
    const chunks = chunkText(text, 1500);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("")).toBe(text);
    for (const c of chunks.slice(1)) expect(c.startsWith("\n\npara")).toBe(true);
  });
});

describe("robots.txt", () => {
  const rules = parseRobots(
    `User-agent: *\nDisallow: /private\nAllow: /private/ok\nDisallow: /*.pdf$\n\nUser-agent: BadBot\nDisallow: /`,
    "StackDowser/0.1",
  );

  it("applies the longest matching rule", () => {
    expect(isAllowed(rules, "/blog/post")).toBe(true);
    expect(isAllowed(rules, "/private/x")).toBe(false);
    expect(isAllowed(rules, "/private/ok/1")).toBe(true);
    expect(isAllowed(rules, "/files/a.pdf")).toBe(false);
    expect(isAllowed(rules, "/files/a.pdf?x=1")).toBe(true);
  });

  it("uses a group naming our agent over the * group", () => {
    const ours = parseRobots(
      `User-agent: *\nDisallow: /\n\nUser-agent: stackdowser\nAllow: /`,
      "StackDowser/0.1",
    );
    expect(isAllowed(ours, "/anything")).toBe(true);
  });
});

describe("feeds and sitemaps", () => {
  it("parses RSS and Atom", () => {
    const rss = `<rss><channel><item><title><![CDATA[How we migrated to Postgres]]></title><link>https://eng.acme.com/pg</link><pubDate>Tue, 04 Nov 2025 10:00:00 GMT</pubDate></item></channel></rss>`;
    expect(parseFeed(rss, "https://eng.acme.com/")).toEqual([
      {
        url: "https://eng.acme.com/pg",
        title: "How we migrated to Postgres",
        publishedAt: "2025-11-04",
      },
    ]);
    const atom = `<feed><entry><title>Scaling search</title><link rel="alternate" href="/search"/><published>2024-01-02T00:00:00Z</published></entry></feed>`;
    expect(parseFeed(atom, "https://eng.acme.com/")[0]).toEqual({
      url: "https://eng.acme.com/search",
      title: "Scaling search",
      publishedAt: "2024-01-02",
    });
  });

  it("finds feed links and sitemap entries", () => {
    expect(
      feedLinks(
        `<link rel="alternate" type="application/rss+xml" href="/feed.xml">`,
        "https://acme.com/blog/",
      ),
    ).toEqual(["https://acme.com/feed.xml"]);
    const sm = parseSitemap(
      `<urlset><url><loc>https://acme.com/blog/a</loc><lastmod>2025-01-01</lastmod></url></urlset>`,
    );
    expect(sm.urls[0]).toEqual({
      url: "https://acme.com/blog/a",
      title: "",
      publishedAt: "2025-01-01",
    });
  });

  it("pulls architecture posts forward", () => {
    const ranked = rankPosts(
      [
        { url: "a", title: "Our new office dog", publishedAt: "2026-09-01" },
        { url: "b", title: "How we scaled Kafka to 1M events/s", publishedAt: "2025-01-01" },
      ],
      1,
    );
    expect(ranked[0]!.url).toBe("b");
  });
});
