import { z } from "zod";

const optional = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

const schema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  LLM_BASE_URL: z.string().url().default("https://api.deepseek.com"),
  LLM_API_KEY: optional,
  LLM_MODEL: z.string().default("deepseek-chat"),
  SEARCH_PROVIDERS: z.string().default("searxng,tavily"),
  SEARXNG_URL: optional,
  TAVILY_API_KEY: optional,
  EMBEDDINGS_URL: optional,
  EMBEDDINGS_MODEL: z.string().default("Qwen/Qwen3-Embedding-0.6B"),
  FETCH_USER_AGENT: z.string().default("StackDowser/0.1"),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(64).default(8),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`invalid environment: ${fields}`);
  }
  return parsed.data;
}
