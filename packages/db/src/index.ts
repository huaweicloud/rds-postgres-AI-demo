import { z } from "zod";

// Mirrors the check constraints in supabase/migrations. Change both together.

export const AGENTS = ["jobs", "blog", "footprint"] as const;
export type Agent = (typeof AGENTS)[number];

export const AGENT_LABELS: Record<Agent, string> = {
  footprint: "Web Footprint",
  jobs: "Job Postings",
  blog: "Engineering Blog",
};

export const USAGES = ["in_use", "hiring_for", "migrated_away", "mentioned"] as const;
export type Usage = (typeof USAGES)[number];

export const CATEGORIES = [
  "language",
  "frontend",
  "backend",
  "database",
  "data",
  "messaging",
  "cloud",
  "infra",
  "devops",
  "observability",
  "ml",
  "saas",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const RUN_STATUSES = ["resolving", "researching", "merging", "done", "failed"] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const TASK_STATUSES = ["queued", "running", "done", "failed", "timed_out"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const researchRunSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid().nullable(),
  requested_by: z.string().uuid().nullable(),
  query: z.string(),
  domain_hint: z.string().nullable(),
  status: z.enum(RUN_STATUSES),
  error: z.string().nullable(),
  replay_of: z.string().uuid().nullable(),
  created_at: z.string(),
  finished_at: z.string().nullable(),
});
export type ResearchRun = z.infer<typeof researchRunSchema>;

export const agentTaskSchema = z.object({
  id: z.string().uuid(),
  run_id: z.string().uuid(),
  agent: z.enum(AGENTS),
  status: z.enum(TASK_STATUSES),
  current_step: z.string().nullable(),
  searches: z.number(),
  pages_read: z.number(),
  llm_calls: z.number(),
  error: z.string().nullable(),
  retries: z.number(),
  started_at: z.string().nullable(),
  heartbeat_at: z.string().nullable(),
  finished_at: z.string().nullable(),
});
export type AgentTask = z.infer<typeof agentTaskSchema>;

// What an agent hands over for every finding. The evidence rule lives here as well as in
// the schema: no URL and snippet, no row.
export const newEvidenceSchema = z.object({
  raw_name: z.string().trim().min(1).max(120),
  category: z.enum(CATEGORIES).nullable(),
  usage: z.enum(USAGES),
  confidence: z.number().min(0).max(1),
  source_url: z.string().min(1).max(2000),
  source_title: z.string().max(300).nullable(),
  snippet: z.string().trim().min(1).max(600),
  published_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
});
export type NewEvidence = z.infer<typeof newEvidenceSchema>;

export const evidenceSchema = newEvidenceSchema.extend({
  id: z.number(),
  run_id: z.string().uuid(),
  task_id: z.string().uuid().nullable(),
  agent: z.enum(AGENTS),
  technology_id: z.number().nullable(),
  found_at: z.string(),
});
export type Evidence = z.infer<typeof evidenceSchema>;

export interface Technology {
  id: number;
  slug: string;
  name: string;
  category: Category;
  aliases: string[];
}

export interface StackEntry {
  company_id: string;
  technology_id: number;
  run_id: string | null;
  score: number;
  status: Usage;
  agent_count: number;
  evidence_count: number;
}

// Display rules from the spec: below this score a technology goes to "weak signals".
export const MAIN_VIEW_MIN_SCORE = 0.5;
export const CORROBORATED_MIN_AGENTS = 2;
