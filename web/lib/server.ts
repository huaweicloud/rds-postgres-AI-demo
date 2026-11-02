import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-side Supabase access. The service role key never leaves this module.

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };

export function serviceClient(): SupabaseClient {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), options);
}

// Acts as the signed-in user, so RLS and the run rate limit apply to what they insert.
export function userClient(accessToken: string): SupabaseClient {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    ...options,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export async function requireUser(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await serviceClient().auth.getUser(token);
  if (error || !data.user) return null;
  return { user: data.user, token };
}

export function publicConfig() {
  return {
    // Unset means "same origin": the proxy forwards the Supabase paths.
    supabaseUrl: process.env.PUBLIC_SUPABASE_URL ?? null,
    anonKey: process.env.SUPABASE_ANON_KEY ?? "",
  };
}
