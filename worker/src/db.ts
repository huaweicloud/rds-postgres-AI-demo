import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Config } from "./config.js";

export type Db = SupabaseClient;

export function createDb(config: Config): Db {
  return createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// supabase-js returns errors instead of throwing; the worker wants them thrown.
export function must<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
