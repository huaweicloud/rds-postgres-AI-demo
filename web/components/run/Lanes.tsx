import { AGENT_LABELS, type Agent } from "@stackdowser/db";
import { AgentIcon } from "../AgentIcon";
import { EvidenceCard } from "./EvidenceCard";
import type { AgentTask, Evidence } from "./types";

// Footprint first: it's the Solution Architect's headline and the fastest lane.
const ORDER: Agent[] = ["footprint", "jobs", "blog"];

export function Lanes({ tasks, evidence }: { tasks: AgentTask[]; evidence: Evidence[] }) {
  return (
    <div className="lanes">
      {ORDER.map((agent) => {
        const task = tasks.find((t) => t.agent === agent);
        const cards = evidence.filter((e) => e.agent === agent);
        return (
          <section key={agent} className={`lane ${task?.status ?? "waiting"}`}>
            <header>
              <h3>
                <span className="lane-icon">
                  <AgentIcon agent={agent} />
                </span>
                {AGENT_LABELS[agent]}
              </h3>
              <span className={`pill ${task?.status ?? "waiting"}`}>
                {task?.status.replace("_", " ") ?? "waiting"}
              </span>
            </header>
            <p className="step" title={task?.current_step ?? ""}>
              {task?.current_step ?? " "}
            </p>
            <p className="counters muted small">
              {cards.length} findings · {task?.pages_read ?? 0} pages · {task?.searches ?? 0}{" "}
              searches
              {task?.llm_calls ? ` · ${task.llm_calls} LLM calls` : ""}
            </p>
            <div className="cards">
              {[...cards].reverse().map((e) => (
                <EvidenceCard key={e.id} e={e} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
