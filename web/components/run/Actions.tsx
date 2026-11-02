"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, useSupabase } from "@/lib/browser";
import type { Company, ResearchRun } from "./types";

interface Similar {
  id: string;
  name: string;
  domain: string | null;
  similarity: number;
  logo_url?: string | null;
}

export function Actions({ run, company }: { run: ResearchRun; company: Company }) {
  const { supabase, session } = useSupabase();
  const router = useRouter();
  const [similar, setSimilar] = useState<Similar[]>([]);
  const [watched, setWatched] = useState(false);
  const [report, setReport] = useState<{ url: string; shared: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void supabase.rpc("similar_companies", { target: company.id, k: 5 }).then(async ({ data }) => {
      const rows = (data as Similar[]) ?? [];
      const { data: logos } = await supabase
        .from("companies")
        .select("id, logo_url")
        .in(
          "id",
          rows.map((r) => r.id),
        );
      const byId = new Map((logos ?? []).map((l) => [l.id as string, l.logo_url as string]));
      setSimilar(rows.map((r) => ({ ...r, logo_url: byId.get(r.id) ?? null })));
    });
  }, [supabase, company.id]);

  useEffect(() => {
    if (!session) return setWatched(false);
    void supabase
      .from("watchlist")
      .select("company_id")
      .eq("company_id", company.id)
      .then(({ data }) => setWatched(Boolean(data?.length)));
  }, [supabase, session, company.id]);

  const act = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const toggleWatch = () =>
    act("watch", async () => {
      const q = watched
        ? supabase.from("watchlist").delete().eq("company_id", company.id)
        : supabase.from("watchlist").insert({ company_id: company.id });
      const { error } = await q;
      if (error) throw new Error(error.message);
      setWatched(!watched);
    });

  // Uses the same company name and domain, skipping the 7-day cache.
  const rerun = () =>
    act("rerun", async () => {
      const r = await api<{ id: string }>(session, "/api/runs", {
        query: company.name,
        domain: company.domain ?? undefined,
        force: true,
      });
      router.push(`/runs/${r.id}`);
    });

  const replay = () =>
    act("replay", async () => {
      const r = await api<{ id: string }>(session, `/api/runs/${run.replay_of ?? run.id}/replay`);
      router.push(`/runs/${r.id}`);
    });

  // Your own runs, and any replay: a replay is a copy and costs nothing to make again.
  const canDelete = Boolean(session && (run.requested_by === session.user.id || run.replay_of));
  const remove = () => {
    if (!window.confirm(`Delete this run of ${company.name}? Its evidence goes with it.`)) return;
    void act("delete", async () => {
      const res = await fetch(`/api/runs/${run.id}`, {
        method: "DELETE",
        headers: session ? { authorization: `Bearer ${session.access_token}` } : {},
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `request failed (${res.status})`);
      router.push("/");
    });
  };

  const exportPdf = () =>
    act("pdf", async () => {
      const res = await fetch(`/api/runs/${run.id}/report`, {
        method: "POST",
        headers: session ? { authorization: `Bearer ${session.access_token}` } : {},
      });
      if (res.headers.get("content-type")?.startsWith("application/pdf")) {
        setReport({ url: URL.createObjectURL(await res.blob()), shared: false });
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? `request failed (${res.status})`);
      setReport({ url: data.url, shared: true });
    });

  return (
    <aside className="actions">
      <section className="panel">
        <h3>Report</h3>
        <button className="primary" onClick={exportPdf} disabled={busy !== null}>
          {busy === "pdf" ? "Generating…" : "Export PDF report"}
        </button>
        {report ? (
          <p className="small">
            <a href={report.url} target="_blank" rel="noreferrer">
              Open the report
            </a>{" "}
            <span className="muted">
              {report.shared ? "(link valid 7 days)" : "(opened locally; storage is unavailable)"}
            </span>
          </p>
        ) : null}
        <button
          className="secondary"
          onClick={toggleWatch}
          disabled={!session || busy !== null}
          title={session ? "" : "Sign in first"}
        >
          {watched ? "★ Remove from watchlist" : "☆ Save to watchlist"}
        </button>
      </section>

      <section className="panel">
        <h3>Run</h3>
        <button className="secondary" onClick={rerun} disabled={!session || busy !== null}>
          {busy === "rerun" ? "Starting…" : "Research again"}
        </button>
        <button className="secondary" onClick={replay} disabled={!session || busy !== null}>
          Replay this run
        </button>
        {canDelete ? (
          <button className="danger" onClick={remove} disabled={busy !== null}>
            {busy === "delete" ? "Deleting…" : "Delete run"}
          </button>
        ) : null}
        {!session ? <p className="muted small">Sign in to research, replay or save.</p> : null}
        {error ? <p className="error small">{error}</p> : null}
      </section>

      <section className="panel">
        <h3>Similar stacks</h3>
        {similar.length ? (
          <ul className="similar">
            {similar.map((s) => (
              <li key={s.id}>
                <Link href={`/companies/${s.id}`}>
                  {s.logo_url ? (
                    <img src={s.logo_url} alt="" width={20} height={20} />
                  ) : (
                    <span className="logo-dot" />
                  )}
                  <span className="similar-name">{s.name}</span>
                  <span className="similar-bar" style={{ ["--s" as string]: s.similarity }} />
                  <span className="muted small">{Math.round(s.similarity * 100)}%</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">Appears once more companies have been researched.</p>
        )}
      </section>
    </aside>
  );
}
