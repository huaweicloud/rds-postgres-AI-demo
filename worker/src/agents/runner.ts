import { newEvidenceSchema, type AgentTask, type NewEvidence } from "@stackdowser/db";
import { must, type Db } from "../db.js";
import { errorMessage, type Logger } from "../log.js";
import type { Services } from "../services.js";
import { AGENT_LIMITS, Budget, BudgetExceeded } from "./budget.js";
import type { AgentFn, AgentContext, RunTarget } from "./types.js";

const HEARTBEAT_MS = 5_000;

export interface RunTaskDeps {
  db: Db;
  services: Services;
  log: Logger;
  agents: Record<AgentTask["agent"], AgentFn>;
}

// Runs one claimed task to the end and reports whether it handed the run to the merger.
export async function runTask(task: AgentTask, target: RunTarget, deps: RunTaskDeps) {
  const { db } = deps;
  const log = deps.log.child({ run: task.run_id, agent: task.agent });
  const budget = new Budget(AGENT_LIMITS);
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new BudgetExceeded("time")),
    AGENT_LIMITS.wallTimeMs,
  );
  let currentStep: string | null = null;
  let emitted = 0;
  const seen = new Set<string>();

  const progress = () => ({
    current_step: currentStep,
    searches: budget.used.searches,
    pages_read: budget.used.pages,
    llm_calls: budget.used.llmCalls,
    heartbeat_at: new Date().toISOString(),
  });

  const heartbeat = setInterval(() => {
    void db
      .from("agent_tasks")
      .update(progress())
      .eq("id", task.id)
      .then(({ error }) => {
        if (error) log.warn("heartbeat failed", { error: error.message });
      });
  }, HEARTBEAT_MS);

  const ctx: AgentContext = {
    target,
    budget,
    services: deps.services,
    log,
    signal: controller.signal,
    async step(text) {
      currentStep = text.slice(0, 200);
      must(await db.from("agent_tasks").update(progress()).eq("id", task.id));
    },
    async emit(evidence: NewEvidence) {
      const parsed = newEvidenceSchema.safeParse(evidence);
      if (!parsed.success) {
        log.warn("evidence rejected", { raw_name: evidence.raw_name, issue: parsed.error.message });
        return;
      }
      // The same fact from the same page adds nothing to the score; skip it.
      const key = `${parsed.data.raw_name.toLowerCase()}|${parsed.data.source_url}|${parsed.data.snippet}`;
      if (seen.has(key)) return;
      seen.add(key);
      must(
        await db
          .from("evidence")
          .insert({ ...parsed.data, run_id: task.run_id, task_id: task.id, agent: task.agent }),
      );
      emitted += 1;
    },
  };

  let status: "done" | "failed" | "timed_out" = "done";
  let error: string | null = null;
  try {
    await deps.agents[task.agent](ctx);
  } catch (err) {
    if (err instanceof BudgetExceeded || controller.signal.aborted) {
      // Running out of budget is the normal way for a busy agent to stop.
      status = err instanceof BudgetExceeded && err.kind !== "time" ? "done" : "timed_out";
    } else {
      status = "failed";
      error = errorMessage(err).slice(0, 500);
      log.error("agent failed", { error });
    }
  } finally {
    clearTimeout(timer);
    clearInterval(heartbeat);
  }

  currentStep = status === "done" ? `finished, ${emitted} findings` : (error ?? status);
  must(await db.from("agent_tasks").update(progress()).eq("id", task.id));
  const handedOff = must(
    await db.rpc("finish_task", { p_task_id: task.id, p_status: status, p_error: error }),
  ) as boolean;
  log.info("task finished", { status, emitted, ...budget.used, handedOff });
  return handedOff;
}
