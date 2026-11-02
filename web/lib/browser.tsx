"use client";

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface Ctx {
  supabase: SupabaseClient;
  session: Session | null;
}

const SupabaseContext = createContext<Ctx | null>(null);

// The browser only talks to Supabase. Config arrives from the server at request time, so one
// image works for any deployment.
export function SupabaseProvider({
  supabaseUrl,
  anonKey,
  children,
}: {
  supabaseUrl: string | null;
  anonKey: string;
  children: ReactNode;
}) {
  const supabase = useMemo(() => {
    // During server rendering there is no window; that client is never used to fetch.
    const origin = typeof window === "undefined" ? "http://localhost" : window.location.origin;
    return createClient(supabaseUrl ?? origin, anonKey);
  }, [supabaseUrl, anonKey]);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  return (
    <SupabaseContext.Provider value={{ supabase, session }}>{children}</SupabaseContext.Provider>
  );
}

export function useSupabase(): Ctx {
  const ctx = useContext(SupabaseContext);
  if (!ctx) throw new Error("useSupabase outside SupabaseProvider");
  return ctx;
}

// Calls one of our API routes as the signed-in user.
export async function api<T>(session: Session | null, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(session ? { authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `request failed (${res.status})`);
  return data;
}
