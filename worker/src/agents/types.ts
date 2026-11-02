import type { NewEvidence } from "@stackdowser/db";
import type { Logger } from "../log.js";
import type { Budget } from "./budget.js";
import type { Services } from "../services.js";

export interface RunTarget {
  runId: string;
  companyName: string;
  domain: string | null;
}

export interface AgentContext {
  target: RunTarget;
  budget: Budget;
  services: Services;
  log: Logger;
  // Aborts at the wall-time limit; pass it to every outbound call.
  signal: AbortSignal;
  // Shown in the agent's lane, e.g. the query it is on.
  step(text: string): Promise<void>;
  // Inserted immediately, so the card appears while the agent keeps working.
  emit(evidence: NewEvidence): Promise<void>;
}

export type AgentFn = (ctx: AgentContext) => Promise<void>;
