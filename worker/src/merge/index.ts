import {
  CATEGORIES,
  MAIN_VIEW_MIN_SCORE,
  USAGES,
  type Category,
  type Evidence,
  type ResearchRun,
  type Technology,
  type Usage,
} from "@stackdowser/db";
import { z } from "zod";
import { toVector } from "../clients/embeddings.js";
import { must, type Db } from "../db.js";
import { errorMessage, type Logger } from "../log.js";
import type { Services } from "../services.js";
import { AliasIndex, isOwnProduct, normalizeName, slugify } from "./normalize.js";
import { assignStatus, score } from "./score.js";

// Most of the merge is plain code. The LLM is used for three batched calls only: names
// the dictionary doesn't know, groups whose evidence disagrees, and the summary.

const normalizeSchema = z.object({
  items: z.array(
    z.object({
      raw: z.string(),
      is_technology: z.boolean(),
      canonical_name: z.string().min(1).max(80).nullable(),
      category: z.enum(CATEGORIES).nullable().catch(null),
    }),
  ),
});

const conflictSchema = z.object({
  items: z.array(z.object({ technology: z.string(), status: z.enum(USAGES) })),
});

const summarySchema = z.object({ summary: z.string().min(20).max(1200) });

interface Group {
  technology: Technology;
  evidence: Evidence[];
}

export interface MergedTech {
  technology: Technology;
  score: number;
  status: Usage;
  agentCount: number;
  evidence: Evidence[];
}

// Each unknown name: alias match, then embedding similarity ≥ 0.9, then the LLM proposes a
// canonical entry that is added to the dictionary.
async function resolveTechnologies(
  evidence: Evidence[],
  db: Db,
  services: Services,
  log: Logger,
): Promise<Map<string, Technology | null>> {
  const technologies = must(
    await db.from("technologies").select("id, slug, name, category, aliases"),
  ) as Technology[];
  const index = new AliasIndex(technologies);
  const resolved = new Map<string, Technology | null>();
  const unknown = new Map<string, Evidence>();

  for (const e of evidence) {
    const key = normalizeName(e.raw_name);
    if (resolved.has(key) || unknown.has(key)) continue;
    const hit = index.lookup(e.raw_name);
    if (hit) resolved.set(key, hit);
    else unknown.set(key, e);
  }

  if (unknown.size && services.embeddings.available) {
    try {
      const keys = [...unknown.keys()];
      const vectors = await services.embeddings.embed(
        keys.map(
          (k) => `${unknown.get(k)!.raw_name} (${unknown.get(k)!.category ?? "technology"})`,
        ),
      );
      for (const [i, key] of keys.entries()) {
        const rows = must(
          await db.rpc("match_technology", {
            query_embedding: toVector(vectors[i]!),
            min_similarity: 0.9,
          }),
        ) as Technology[];
        const match = rows[0] ? technologies.find((t) => t.id === rows[0]!.id) : undefined;
        if (match) {
          resolved.set(key, match);
          unknown.delete(key);
        }
      }
    } catch (err) {
      log.warn("embedding match failed", { error: errorMessage(err) });
    }
  }

  if (!unknown.size) return resolved;

  let proposals: z.infer<typeof normalizeSchema>["items"] = [];
  if (services.llm.available) {
    try {
      const list = [...unknown.values()]
        .map((e) => `- ${e.raw_name} (agent guessed: ${e.category ?? "unknown"})`)
        .join("\n");
      proposals = (
        await services.llm.json({
          system: `You normalize technology names for a tech-stack catalog. Return json:
{"items": [{"raw": "...", "is_technology": true, "canonical_name": "...", "category": "..."}]}
- canonical_name: the product's usual name without versions ("PostgreSQL", "Apache Kafka").
- category: one of ${CATEGORIES.join(", ")}.
- is_technology: false for things that are not software, languages, services or platforms
  (job titles, methodologies like "agile", generic words like "APIs" or "microservices").`,
          user: list,
          schema: normalizeSchema,
          maxTokens: 2_000,
        })
      ).items;
    } catch (err) {
      log.warn("normalize call failed", { error: errorMessage(err) });
    }
  }

  for (const [key, e] of unknown) {
    const p = proposals.find((x) => normalizeName(x.raw) === key);
    if (p && !p.is_technology) {
      resolved.set(key, null);
      continue;
    }
    const canonical = p?.canonical_name ?? e.raw_name;
    const existing = index.lookup(canonical);
    const category: Category | null = p?.category ?? e.category;
    if (existing) {
      resolved.set(key, existing);
      continue;
    }
    if (!category) {
      resolved.set(key, null);
      continue;
    }
    const aliases = [...new Set([normalizeName(canonical), key])];
    const { data, error } = await db
      .from("technologies")
      .upsert(
        { slug: slugify(canonical), name: canonical, category, aliases },
        { onConflict: "slug" },
      )
      .select("id, slug, name, category, aliases")
      .single();
    if (error || !data) {
      log.warn("could not add technology", { name: canonical, error: error?.message });
      resolved.set(key, null);
      continue;
    }
    const tech = data as Technology;
    index.add(tech);
    resolved.set(key, tech);
    if (services.embeddings.available) {
      services.embeddings
        .embed([`${tech.name} (${tech.category})`])
        .then(([v]) =>
          db
            .from("technologies")
            .update({ name_embedding: toVector(v!) })
            .eq("id", tech.id),
        )
        .catch(() => undefined);
    }
  }
  return resolved;
}

export function stackProfile(merged: MergedTech[]): string {
  const byCategory = new Map<string, string[]>();
  for (const m of merged) {
    if (m.status === "migrated_away") continue;
    byCategory.set(m.technology.category, [
      ...(byCategory.get(m.technology.category) ?? []),
      m.technology.name,
    ]);
  }
  return [...byCategory.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([c, names]) => `${c}: ${names.sort((a, b) => a.localeCompare(b)).join(", ")}`)
    .join("\n");
}

export async function mergeRun(
  run: ResearchRun,
  db: Db,
  services: Services,
  log: Logger,
): Promise<MergedTech[]> {
  const company = must(
    await db.from("companies").select("name").eq("id", run.company_id).single(),
  ) as { name: string };
  const evidence = (
    must(await db.from("evidence").select("*").eq("run_id", run.id)) as Evidence[]
  ).filter((e) => !isOwnProduct(e.raw_name, company.name));
  const techs = await resolveTechnologies(evidence, db, services, log);

  const groups = new Map<number, Group>();
  for (const e of evidence) {
    const tech = techs.get(normalizeName(e.raw_name));
    // The raw name may hide it ("Payment Element"), the canonical one rarely does.
    if (!tech || isOwnProduct(tech.name, company.name)) continue;
    e.technology_id = tech.id;
    const g = groups.get(tech.id) ?? { technology: tech, evidence: [] };
    g.evidence.push(e);
    groups.set(tech.id, g);
  }

  // Write the canonical id back onto each evidence row, one update per technology.
  await Promise.all(
    [...groups.values()].map((g) =>
      db
        .from("evidence")
        .update({ technology_id: g.technology.id })
        .in(
          "id",
          g.evidence.map((e) => e.id),
        ),
    ),
  );

  const merged: MergedTech[] = [];
  const conflicts: { group: Group; candidates: Usage[] }[] = [];
  for (const g of groups.values()) {
    const s = score(g.evidence);
    const status = assignStatus(g.evidence);
    const m: MergedTech = {
      technology: g.technology,
      score: s,
      status: "conflict" in status ? status.candidates[0]! : status.status,
      agentCount: new Set(g.evidence.map((e) => e.agent)).size,
      evidence: g.evidence,
    };
    merged.push(m);
    if ("conflict" in status) conflicts.push({ group: g, candidates: status.candidates });
  }

  // Only the disagreeing groups go to the LLM, with their snippets.
  if (conflicts.length && services.llm.available) {
    try {
      const body = conflicts
        .map(
          (c) =>
            `## ${c.group.technology.name}\n` +
            c.group.evidence
              .slice(0, 6)
              .map(
                (e) => `- [${e.usage}] (${e.published_at ?? "undated"}, ${e.agent}) "${e.snippet}"`,
              )
              .join("\n"),
        )
        .join("\n\n");
      const r = await services.llm.json({
        system: `You decide whether a company still uses each technology, from conflicting evidence.
Return json: {"items": [{"technology": "...", "status": "in_use" | "hiring_for" | "migrated_away" | "mentioned"}]}.
Prefer the most recent, most specific statement about the company's own systems.`,
        user: body,
        schema: conflictSchema,
        maxTokens: 800,
      });
      for (const item of r.items) {
        const m = merged.find(
          (x) => x.technology.name.toLowerCase() === item.technology.toLowerCase(),
        );
        if (m) m.status = item.status;
      }
    } catch (err) {
      log.warn("conflict call failed", { error: errorMessage(err) });
    }
  }

  merged.sort((a, b) => b.score - a.score);
  if (!run.company_id) return merged;

  must(await db.from("company_stack").delete().eq("company_id", run.company_id));
  if (merged.length) {
    must(
      await db.from("company_stack").insert(
        merged.map((m) => ({
          company_id: run.company_id,
          technology_id: m.technology.id,
          run_id: run.id,
          score: Number(m.score.toFixed(4)),
          status: m.status,
          agent_count: m.agentCount,
          evidence_count: m.evidence.length,
        })),
      ),
    );
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const main = merged.filter((m) => m.score >= MAIN_VIEW_MIN_SCORE);
  if (services.llm.available && main.length) {
    try {
      const list = main
        .map(
          (m) => `- ${m.technology.name} (${m.technology.category}, ${m.status.replace("_", " ")})`,
        )
        .join("\n");
      const r = await services.llm.json({
        system: `You write a 3 to 4 sentence architecture summary of a company's tech stack for a Solution Architect.
Return json: {"summary": "..."}. Mention only technologies from the list; never add others.
Plain sentences: hosting and cloud first, then the application layer, then data and tooling.`,
        user: `Company: ${company.name}\n\n${list}`,
        schema: summarySchema,
        maxTokens: 400,
      });
      update.summary = r.summary;
    } catch (err) {
      log.warn("summary call failed", { error: errorMessage(err) });
    }
  }
  if (services.embeddings.available && merged.length) {
    try {
      const [v] = await services.embeddings.embed([stackProfile(main.length ? main : merged)]);
      update.stack_embedding = toVector(v!);
    } catch (err) {
      log.warn("stack embedding failed", { error: errorMessage(err) });
    }
  }
  must(await db.from("companies").update(update).eq("id", run.company_id));
  return merged;
}

export async function handleMerge(run: ResearchRun, db: Db, services: Services, log: Logger) {
  try {
    const merged = await mergeRun(run, db, services, log);
    must(
      await db
        .from("research_runs")
        .update({ status: "done", finished_at: new Date().toISOString() })
        .eq("id", run.id),
    );
    log.info("run merged", { run: run.id, technologies: merged.length });
  } catch (err) {
    // Leave it in merging: recover_runs() clears merge_started_at and another worker retries.
    log.error("merge failed", { run: run.id, error: errorMessage(err) });
    throw err;
  }
}
