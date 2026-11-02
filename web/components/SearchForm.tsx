"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, useSupabase } from "@/lib/browser";

export function SearchForm() {
  const { session } = useSupabase();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ id: string; cached: boolean }>(session, "/api/runs", {
        query,
        domain: domain || undefined,
      });
      router.push(`/runs/${r.id}${r.cached ? "?cached=1" : ""}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <form className="search" onSubmit={submit}>
      <input
        className="search-main"
        placeholder="Company name"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        required
        minLength={2}
        autoFocus
      />
      <input
        className="search-domain"
        placeholder="domain.com (optional)"
        value={domain}
        onChange={(e) => setDomain(e.target.value)}
      />
      <button
        type="submit"
        disabled={busy || !session}
        title={session ? "" : "Sign in to start a run"}
      >
        {busy ? "Starting…" : "Investigate"}
      </button>
      {!session ? <p className="muted small">Sign in to start a run. Anyone can watch.</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}
