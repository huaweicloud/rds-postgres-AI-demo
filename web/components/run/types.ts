import type { AgentTask, Evidence, ResearchRun } from "@stackdowser/db";

export interface Company {
  id: string;
  name: string;
  domain: string | null;
  description: string | null;
  logo_url: string | null;
  summary: string | null;
}

export interface StackRow {
  technology_id: number;
  score: number;
  status: string;
  agent_count: number;
  evidence_count: number;
  technologies: { name: string; category: string; slug: string };
}

export type { AgentTask, Evidence, ResearchRun };
