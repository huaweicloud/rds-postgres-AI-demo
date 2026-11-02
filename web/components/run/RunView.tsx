"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CORROBORATED_MIN_AGENTS, MAIN_VIEW_MIN_SCORE } from "@stackdowser/db";
import { useSupabase } from "@/lib/browser";
import { Actions } from "./Actions";
import { Lanes } from "./Lanes";
import { StackView } from "./StackView";
import type { AgentTask, Company, Evidence, ResearchRun, StackRow } from "./types";

const PHASES: Record<ResearchRun["status"], string> = {
  resolving: "Identifying the company",
  researching: "Agents at work",
  merging: "Merging and scoring the evidence",
  done: "Done",
  failed: "Failed",
};

export function RunView({ id, cached }: { id: string; cached: boolean }) {
  const { supabase } = useSupabase();
  const [run, setRun] = useState<ResearchRun | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [stack, setStack] = useState<StackRow[]>([]);
  const [view, setView] = useState<"lanes" | "stack">("lanes");
  const [elapsed, setElapsed] = useState(0);
  const companyId = useRef<string | null>(null);

  const loadCompany = useCallback(
    async (cid: string) => {
      companyId.current = cid;
      const { data } = await supabase.from("companies").select("*").eq("id", cid).single();
      if (data) setCompany(data as Company);
    },
    [supabase],
  );

  const loadResults = useCallback(
    async (cid: string) => {
      const [{ data: s }, { data: e }] = await Promise.all([
        supabase
          .from("company_stack")
          .select(
            "technology_id, score, status, agent_count, evidence_count, technologies(name, category, slug)",
          )
          .eq("company_id", cid)
          .order("score", { ascending: false }),
        // Reload evidence: the merger has written technology_id onto every row.
        supabase.from("evidence").select("*").eq("run_id", id).order("id"),
      ]);
      setStack((s as unknown as StackRow[]) ?? []);
      if (e) setEvidence(e as Evidence[]);
      await loadCompany(cid);
      setView("stack");
    },
    [supabase, id, loadCompany],
  );

  useEffect(() => {
    const addEvidence = (rows: Evidence[]) =>
      setEvidence((prev) => {
        const seen = new Set(prev.map((e) => e.id));
        const fresh = rows.filter((r) => !seen.has(r.id));
        return fresh.length ? [...prev, ...fresh].sort((a, b) => a.id - b.id) : prev;
      });
    const upsertTask = (t: AgentTask) =>
      setTasks((prev) => [...prev.filter((x) => x.id !== t.id), t]);

    let loadedFor: string | null = null;
    const onRun = (r: ResearchRun) => {
      setRun(r);
      if (r.company_id && r.company_id !== companyId.current) void loadCompany(r.company_id);
      const key = `${r.status}:${r.finished_at}`;
      if (r.status === "done" && r.company_id && loadedFor !== key) {
        loadedFor = key;
        void loadResults(r.company_id);
      }
    };

    const load = async () => {
      const [{ data: r }, { data: t }, { data: e }] = await Promise.all([
        supabase.from("research_runs").select("*").eq("id", id).single(),
        supabase.from("agent_tasks").select("*").eq("run_id", id),
        supabase.from("evidence").select("*").eq("run_id", id).order("id"),
      ]);
      if (t) setTasks(t as AgentTask[]);
      if (e) addEvidence(e as Evidence[]);
      if (r) onRun(r as ResearchRun);
    };

    // Loading again once subscribed means nothing that lands in between is missed.
    const channel = supabase
      .channel(`run:${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "evidence", filter: `run_id=eq.${id}` },
        (p) => addEvidence([p.new as Evidence]),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_tasks", filter: `run_id=eq.${id}` },
        (p) => {
          if (p.new && "id" in p.new) upsertTask(p.new as AgentTask);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "research_runs", filter: `id=eq.${id}` },
        (p) => onRun(p.new as ResearchRun),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void load();
      });
    // Also load straight away: if the websocket is blocked the page still shows the run.
    void load();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, id, loadCompany, loadResults]);

  useEffect(() => {
    if (!run || run.status === "done" || run.status === "failed") return;
    const start = new Date(run.created_at).getTime();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - start) / 1000)), 500);
    return () => clearInterval(timer);
  }, [run]);

  if (!run) return <p className="muted">Loading…</p>;

  const live = run.status !== "done" && run.status !== "failed";
  const main = stack.filter((r) => r.score >= MAIN_VIEW_MIN_SCORE);
  // From the agents, not the run: a later re-merge moves the run's finished_at.
  const lastTask = Math.max(...tasks.map((t) => (t.finished_at ? Date.parse(t.finished_at) : 0)));
  const seconds =
    !live && lastTask > 0 && !run.replay_of
      ? Math.round((lastTask - Date.parse(run.created_at)) / 1000)
      : null;
  const stats: [string, string | number][] = [
    ["Technologies", main.length],
    ["Corroborated", main.filter((r) => r.agent_count >= CORROBORATED_MIN_AGENTS).length],
    ["Findings", evidence.length],
    ["Sources", new Set(evidence.map((e) => e.source_url)).size],
    ...(seconds !== null ? ([["Research time", `${seconds}s`]] as [string, string][]) : []),
  ];
  const name = company?.name ?? run.query;
  return (
    <div className="run">
      <section className="company-hero">
        <div className="company">
          {company?.logo_url ? (
            <img className="company-logo" src={company.logo_url} alt="" width={56} height={56} />
          ) : (
            <div className="company-logo blank">{name.slice(0, 1)}</div>
          )}
          <div className="company-text">
            <h1>{name}</h1>
            <p className="muted">
              {company?.domain ? (
                <a href={`https://${company.domain}`} target="_blank" rel="noreferrer noopener">
                  {company.domain}
                </a>
              ) : null}
              {company?.domain && company?.description ? " · " : null}
              {company?.description}
            </p>
          </div>
          <div className={`phase ${run.status}`}>
            {PHASES[run.status]}
            {live ? <span className="muted"> · {elapsed}s</span> : null}
            {run.replay_of ? <span className="tag soft">replay</span> : null}
            {cached ? <span className="tag soft">cached profile</span> : null}
          </div>
        </div>
        {run.status === "done" ? (
          <dl className="stats">
            {stats.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </section>

      {run.status === "failed" ? <p className="error">{run.error ?? "The run failed."}</p> : null}
      {company?.summary && run.status === "done" ? (
        <section className="summary">
          <h2>Architecture summary</h2>
          <p>{company.summary}</p>
        </section>
      ) : null}

      {run.status === "done" ? (
        <div className="tabs">
          <button className={view === "stack" ? "active" : ""} onClick={() => setView("stack")}>
            Stack ({main.length})
          </button>
          <button className={view === "lanes" ? "active" : ""} onClick={() => setView("lanes")}>
            Agent lanes ({evidence.length} findings)
          </button>
        </div>
      ) : null}

      {run.status === "merging" ? (
        <p className="merging">
          Deduping {evidence.length} findings into canonical technologies and scoring them…
        </p>
      ) : null}

      <div className="run-body">
        <div className="run-main">
          {view === "stack" && run.status === "done" ? (
            <StackView stack={stack} evidence={evidence} />
          ) : (
            <div className={run.status === "merging" ? "collapsing" : ""}>
              <Lanes tasks={tasks} evidence={evidence} />
            </div>
          )}
        </div>
        {run.status === "done" && company ? <Actions run={run} company={company} /> : null}
      </div>
    </div>
  );
}
