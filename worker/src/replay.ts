import type { AgentTask, Evidence, ResearchRun } from "@stackdowser/db";
import { must, type Db } from "./db.js";
import { errorMessage, type Logger } from "./log.js";

// The demo safety net: re-inserts a saved run's evidence with its original timing, so
// Realtime streams it exactly as it would live. The merge then runs for real.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function handleReplay(run: ResearchRun, db: Db, log: Logger) {
  try {
    const source = must(
      await db
        .from("research_runs")
        .select("id, company_id, created_at")
        .eq("id", run.replay_of!)
        .single(),
    ) as { id: string; company_id: string | null; created_at: string };
    const tasks = must(
      await db.from("agent_tasks").select("*").eq("run_id", source.id).order("started_at"),
    ) as AgentTask[];
    const evidence = must(
      await db.from("evidence").select("*").eq("run_id", source.id).order("found_at"),
    ) as Evidence[];
    if (!tasks.length) throw new Error("the run to replay has no agent tasks");

    must(
      await db
        .from("research_runs")
        .update({ company_id: source.company_id, status: "researching" })
        .eq("id", run.id),
    );

    const start = Math.min(
      ...tasks.map((t) => new Date(t.started_at ?? source.created_at).getTime()),
    );
    const t0 = Date.now();
    const at = (iso: string | null) => (iso ? new Date(iso).getTime() - start : 0);

    const copies = must(
      await db
        .from("agent_tasks")
        .insert(
          tasks.map((t) => ({
            run_id: run.id,
            agent: t.agent,
            status: "running",
            current_step: "replaying a saved run",
            started_at: new Date().toISOString(),
            heartbeat_at: new Date().toISOString(),
          })),
        )
        .select("id, agent"),
    ) as { id: string; agent: string }[];
    const newTaskId = new Map(
      tasks.map((t) => [t.id, copies.find((c) => c.agent === t.agent)!.id]),
    );

    // One timeline of events: each evidence insert, and each task finishing.
    type Event = { at: number; run: () => Promise<unknown> };
    const counts = new Map<string, number>();
    const events: Event[] = [
      ...evidence.map((e) => ({
        at: at(e.found_at),
        run: async () => {
          const taskId = e.task_id ? newTaskId.get(e.task_id) : undefined;
          const { id: _id, technology_id: _tech, found_at: _found, ...rest } = e;
          must(
            await db.from("evidence").insert({ ...rest, run_id: run.id, task_id: taskId ?? null }),
          );
          if (taskId) {
            const n = (counts.get(taskId) ?? 0) + 1;
            counts.set(taskId, n);
            await db
              .from("agent_tasks")
              .update({ pages_read: n, heartbeat_at: new Date().toISOString() })
              .eq("id", taskId);
          }
        },
      })),
      ...tasks.map((t) => ({
        at: at(t.finished_at),
        run: async () => {
          const id = newTaskId.get(t.id)!;
          await db
            .from("agent_tasks")
            .update({
              current_step: t.current_step,
              searches: t.searches,
              pages_read: t.pages_read,
              llm_calls: t.llm_calls,
            })
            .eq("id", id);
          const status = t.status === "running" || t.status === "queued" ? "done" : t.status;
          must(await db.rpc("finish_task", { p_task_id: id, p_status: status, p_error: t.error }));
        },
      })),
    ].sort((a, b) => a.at - b.at);

    // Without a heartbeat, recover_runs() would hand a quiet replay task to a real agent.
    const heartbeat = setInterval(() => {
      void db
        .from("agent_tasks")
        .update({ heartbeat_at: new Date().toISOString() })
        .eq("run_id", run.id)
        .eq("status", "running");
    }, 10_000);
    try {
      for (const event of events) {
        const wait = event.at - (Date.now() - t0);
        if (wait > 0) await sleep(wait);
        await event.run();
      }
    } finally {
      clearInterval(heartbeat);
    }
    log.info("replay finished", { run: run.id, source: source.id, evidence: evidence.length });
  } catch (err) {
    log.error("replay failed", { run: run.id, error: errorMessage(err) });
    await db
      .from("research_runs")
      .update({
        status: "failed",
        error: errorMessage(err).slice(0, 300),
        finished_at: new Date().toISOString(),
      })
      .eq("id", run.id);
  }
}
