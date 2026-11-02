import {
  agentTaskSchema,
  researchRunSchema,
  type AgentTask,
  type ResearchRun,
} from "@stackdowser/db";
import { footprintAgent } from "./agents/footprint/index.js";
import { runTask } from "./agents/runner.js";
import type { AgentFn, RunTarget } from "./agents/types.js";
import { checkSearxng } from "./clients/search.js";
import { loadConfig } from "./config.js";
import { createDb, must, type Db } from "./db.js";
import { createLogger, errorMessage } from "./log.js";
import { handleMerge } from "./merge/index.js";
import { handleReplay } from "./replay.js";
import { handleResolve } from "./resolve.js";
import { createServices, type Services } from "./services.js";
import { jobsAgent } from "./agents/jobs/index.js";
import { blogAgent } from "./agents/blog/index.js";

const IDLE_POLL_MS = 1_000;

const AGENTS: Record<AgentTask["agent"], AgentFn> = {
  footprint: footprintAgent,
  jobs: jobsAgent,
  blog: blogAgent,
};

async function claimOne<T>(
  db: Db,
  fn: string,
  schema: { parse(v: unknown): T },
): Promise<T | null> {
  const rows = must(await db.rpc(fn)) as unknown[] | null;
  return rows?.[0] ? schema.parse(rows[0]) : null;
}

async function targetFor(db: Db, runId: string): Promise<RunTarget> {
  const run = must(
    await db.from("research_runs").select("id, companies(name, domain)").eq("id", runId).single(),
  ) as unknown as { id: string; companies: { name: string; domain: string | null } | null };
  return { runId, companyName: run.companies?.name ?? "", domain: run.companies?.domain ?? null };
}

async function main() {
  const config = loadConfig();
  const log = createLogger({ service: "worker" });
  const db = createDb(config);
  const services: Services = createServices(config, db, log);

  if (config.SEARXNG_URL) await checkSearxng(config.SEARXNG_URL);
  if (!services.llm.available)
    log.warn("LLM_API_KEY not set: jobs and blog agents will skip extraction");
  void services.ipRanges.get();

  let active = 0;
  let stopping = false;
  const running = new Set<Promise<unknown>>();

  const start = (label: string, work: () => Promise<unknown>) => {
    active += 1;
    const p = work()
      .catch((err) => log.error(`${label} crashed`, { error: errorMessage(err) }))
      .finally(() => {
        active -= 1;
        running.delete(p);
      });
    running.add(p);
  };

  // Merges first so finished runs complete before new work starts, then resolves (a cheap
  // step that unblocks four tasks), then agent tasks.
  const claimNext = async (): Promise<boolean> => {
    const merge = await claimOne<ResearchRun>(db, "claim_merge", researchRunSchema);
    if (merge) {
      start("merge", () => handleMerge(merge, db, services, log));
      return true;
    }
    const resolve = await claimOne<ResearchRun>(db, "claim_resolve", researchRunSchema);
    if (resolve) {
      start("resolve", () =>
        resolve.replay_of
          ? handleReplay(resolve, db, log)
          : handleResolve(resolve, db, services, log),
      );
      return true;
    }
    const task = await claimOne<AgentTask>(db, "claim_task", agentTaskSchema);
    if (task) {
      start("task", async () =>
        runTask(task, await targetFor(db, task.run_id), { db, services, log, agents: AGENTS }),
      );
      return true;
    }
    return false;
  };

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      log.info("stopping; waiting for running work", { active });
      stopping = true;
    });
  }

  log.info("worker started", { concurrency: config.WORKER_CONCURRENCY });
  while (!stopping) {
    let claimed = false;
    if (active < config.WORKER_CONCURRENCY) {
      try {
        claimed = await claimNext();
      } catch (err) {
        log.warn("claim failed", { error: errorMessage(err) });
      }
    }
    if (!claimed) await new Promise((r) => setTimeout(r, IDLE_POLL_MS));
  }
  await Promise.allSettled([...running]);
}

main().catch((err) => {
  console.error(errorMessage(err));
  process.exit(1);
});
