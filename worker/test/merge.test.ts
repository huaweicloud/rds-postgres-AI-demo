import { describe, expect, it } from "vitest";
import type { Technology } from "@stackdowser/db";
import { AliasIndex, isOwnProduct, normalizeName, slugify } from "../src/merge/normalize.js";
import { assignStatus, score, weight, type ScoredInput } from "../src/merge/score.js";

describe("normalizeName", () => {
  it.each([
    ["PostgreSQL 15", "postgresql"],
    ["Python 3.x", "python"],
    ["Node.js v18", "node.js"],
    ["  Kafka ", "kafka"],
    ["React (Hooks)", "react"],
    ["C++", "c++"],
    ["Python3", "python3"],
  ])("%s → %s", (raw, expected) => {
    expect(normalizeName(raw)).toBe(expected);
  });

  it("makes slugs from names with symbols", () => {
    expect(slugify("C#")).toBe("csharp");
    expect(slugify("Apache Kafka")).toBe("apache-kafka");
  });

  it("recognizes the company's own products", () => {
    expect(isOwnProduct("Acme Checkout", "Acme")).toBe(true);
    expect(isOwnProduct("acme", "Acme")).toBe(true);
    expect(isOwnProduct("Acme.js", "Acme")).toBe(true);
    expect(isOwnProduct("Acmeflow", "Acme")).toBe(false);
    expect(isOwnProduct("PostgreSQL", "Acme")).toBe(false);
  });
});

describe("AliasIndex", () => {
  const pg: Technology = {
    id: 1,
    slug: "postgresql",
    name: "PostgreSQL",
    category: "database",
    aliases: ["postgresql", "postgres", "aws rds postgres"],
  };
  const kafka: Technology = {
    id: 2,
    slug: "kafka",
    name: "Apache Kafka",
    category: "messaging",
    aliases: ["kafka", "apache kafka"],
  };
  const index = new AliasIndex([pg, kafka]);

  it("matches aliases after normalizing", () => {
    expect(index.lookup("Postgres 16")?.id).toBe(1);
    expect(index.lookup("AWS RDS Postgres")?.id).toBe(1);
    expect(index.lookup("PostgreSQL")?.id).toBe(1);
    expect(index.lookup("Apache Kafka 3.6")?.id).toBe(2);
  });

  it("returns null for unknown names", () => {
    expect(index.lookup("ScyllaDB")).toBeNull();
  });
});

const now = new Date("2026-10-01T00:00:00Z");
const ev = (over: Partial<ScoredInput>): ScoredInput => ({
  agent: "jobs",
  confidence: 1,
  usage: "in_use",
  published_at: null,
  ...over,
});

describe("score", () => {
  it("uses the source weight times confidence for one piece of evidence", () => {
    expect(score([ev({ agent: "footprint", confidence: 0.9 })], now)).toBeCloseTo(0.95 * 0.9);
  });

  it("lets independent sources reinforce each other", () => {
    const a = ev({ agent: "jobs", confidence: 0.6 });
    const b = ev({ agent: "footprint", confidence: 0.6 });
    const combined = score([a, b], now);
    expect(combined).toBeCloseTo(1 - (1 - 0.54) * (1 - 0.57));
    expect(combined).toBeGreaterThan(Math.max(weight(a, now), weight(b, now)));
  });

  it("halves a blog post's weight every two years", () => {
    const fresh = weight(ev({ agent: "blog", published_at: "2026-10-01" }), now);
    const old = weight(ev({ agent: "blog", published_at: "2024-10-01" }), now);
    expect(old / fresh).toBeCloseTo(0.5, 2);
  });

  it("treats job posts as current whatever their date", () => {
    expect(weight(ev({ agent: "jobs", published_at: "2020-01-01" }), now)).toBeCloseTo(0.9);
  });

  it("stays below 1", () => {
    expect(
      score(
        Array.from({ length: 20 }, () => ev({})),
        now,
      ),
    ).toBeLessThanOrEqual(1);
  });
});

describe("assignStatus", () => {
  it("follows the spec example: old migration post, new job posts", () => {
    const mongo = [ev({ agent: "blog", usage: "migrated_away", published_at: "2021-03-01" })];
    const postgres = [
      ev({ agent: "blog", usage: "in_use", published_at: "2021-03-01" }),
      ev({ agent: "jobs", usage: "hiring_for" }),
    ];
    expect(assignStatus(mongo, now)).toEqual({ status: "migrated_away" });
    expect(assignStatus(postgres, now)).toEqual({ status: "in_use" });
  });

  it("lets newer evidence override an old migration", () => {
    const evidence = [
      ev({ agent: "blog", usage: "migrated_away", published_at: "2019-01-01" }),
      ev({ agent: "footprint", usage: "in_use" }),
    ];
    expect(assignStatus(evidence, now)).toEqual({ status: "in_use" });
  });

  it("keeps hiring_for when nothing shows it in use", () => {
    expect(assignStatus([ev({ usage: "hiring_for" })], now)).toEqual({ status: "hiring_for" });
  });

  it("flags same-date disagreement as a conflict", () => {
    const evidence = [
      ev({ agent: "blog", usage: "migrated_away", published_at: "2026-09-01" }),
      ev({ agent: "blog", usage: "in_use", published_at: "2026-09-10" }),
    ];
    expect(assignStatus(evidence, now)).toEqual({
      conflict: true,
      candidates: ["in_use", "migrated_away"],
    });
  });
});
