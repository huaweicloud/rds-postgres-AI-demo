import type { Agent, Usage } from "@stackdowser/db";

// score(t) = 1 - Π(1 - w_i), w_i = s_i · c_i · 2^(-a_i / h): independent sources reinforce each
// other, and old blog posts count for less.

export const SOURCE_WEIGHT: Record<Agent, number> = {
  footprint: 0.95,
  jobs: 0.9,
  blog: 0.8,
};

export const HALF_LIFE_YEARS = 2;

// A blog post with no date is treated as this old: it may well be stale.
export const UNDATED_BLOG_AGE_YEARS = 2;

export interface ScoredInput {
  agent: Agent;
  confidence: number;
  usage: Usage | null;
  published_at: string | null;
}

export function ageYears(e: ScoredInput, now = new Date()): number {
  // Job posts and footprint evidence describe the present.
  if (e.agent === "jobs" || e.agent === "footprint") return 0;
  if (!e.published_at) return e.agent === "blog" ? UNDATED_BLOG_AGE_YEARS : 0;
  const years = (now.getTime() - new Date(e.published_at).getTime()) / (365.25 * 86_400_000);
  return Math.max(0, years);
}

export function weight(e: ScoredInput, now = new Date()): number {
  return SOURCE_WEIGHT[e.agent] * e.confidence * 2 ** (-ageYears(e, now) / HALF_LIFE_YEARS);
}

export function score(evidence: ScoredInput[], now = new Date()): number {
  return 1 - evidence.reduce((p, e) => p * (1 - weight(e, now)), 1);
}

export type StatusResult = { status: Usage } | { conflict: true; candidates: Usage[] };

// The newest-dated evidence decides. Current sources (jobs, footprint) are dated today.
// Within the newest group: in_use beats hiring_for beats mentioned, since a job post
// asking for a tool the company already runs means it's in use. in_use against migrated_away
// at the same date is a real disagreement and goes to the LLM.
export function assignStatus(evidence: ScoredInput[], now = new Date()): StatusResult {
  if (!evidence.length) return { status: "mentioned" };
  const dated = evidence.map((e) => ({ e, age: ageYears(e, now) }));
  const newestAge = Math.min(...dated.map((d) => d.age));
  // Within ~3 months counts as the same moment.
  const newest = dated.filter((d) => d.age - newestAge < 0.25).map((d) => d.e.usage ?? "mentioned");
  const has = (u: Usage) => newest.includes(u);

  if (has("in_use") && has("migrated_away"))
    return { conflict: true, candidates: ["in_use", "migrated_away"] };
  if (has("migrated_away") && has("hiring_for"))
    return { conflict: true, candidates: ["hiring_for", "migrated_away"] };
  if (has("migrated_away")) return { status: "migrated_away" };
  if (has("in_use")) return { status: "in_use" };
  if (has("hiring_for")) {
    // Hiring for something an older source already showed in production: still in use.
    const olderInUse = dated.some((d) => d.e.usage === "in_use");
    return { status: olderInUse ? "in_use" : "hiring_for" };
  }
  return { status: "mentioned" };
}
