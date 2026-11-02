"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MAIN_VIEW_MIN_SCORE } from "@stackdowser/db";
import { useSupabase } from "@/lib/browser";
import { TechLogo } from "./TechLogo";

interface Run {
  id: string;
  created_at: string;
  company_id: string;
  companies: { name: string; domain: string | null; logo_url: string | null } | null;
}

interface Top {
  company_id: string;
  technologies: { name: string; slug: string; category: string };
}

const LOGOS_PER_CARD = 7;

// One card per company: its latest finished run and the logos of its strongest technologies.
export function RecentRuns() {
  const { supabase } = useSupabase();
  const [runs, setRuns] = useState<Run[]>([]);
  const [tops, setTops] = useState<Map<string, Top[]>>(new Map());
  const [counts, setCounts] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("research_runs")
        .select("id, created_at, company_id, companies(name, domain, logo_url)")
        .eq("status", "done")
        .is("replay_of", null)
        .not("company_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(60);
      const seen = new Set<string>();
      const latest = ((data as unknown as Run[]) ?? []).filter(
        (r) => !seen.has(r.company_id) && seen.add(r.company_id),
      );
      setRuns(latest.slice(0, 12));
      if (!latest.length) return;
      const { data: stack } = await supabase
        .from("company_stack")
        .select("company_id, technologies(name, slug, category)")
        .in(
          "company_id",
          latest.map((r) => r.company_id),
        )
        .gte("score", MAIN_VIEW_MIN_SCORE)
        .order("score", { ascending: false });
      const byCompany = new Map<string, Top[]>();
      for (const row of (stack as unknown as Top[]) ?? []) {
        byCompany.set(row.company_id, [...(byCompany.get(row.company_id) ?? []), row]);
      }
      setTops(byCompany);
      setCounts(new Map([...byCompany].map(([k, v]) => [k, v.length])));
    })();
  }, [supabase]);

  if (!runs.length) return null;
  return (
    <section className="recent">
      <h2>Recently researched</h2>
      <div className="company-grid">
        {runs.map((r) => {
          const top = tops.get(r.company_id) ?? [];
          const total = counts.get(r.company_id) ?? 0;
          return (
            <Link key={r.id} href={`/runs/${r.id}`} className="company-card">
              <div className="company-card-head">
                {r.companies?.logo_url ? (
                  <img src={r.companies.logo_url} alt="" width={36} height={36} />
                ) : (
                  <span className="company-logo blank small">
                    {(r.companies?.name ?? "?").slice(0, 1)}
                  </span>
                )}
                <div>
                  <strong>{r.companies?.name}</strong>
                  <span className="muted small">{r.companies?.domain}</span>
                </div>
              </div>
              <div className="logo-row">
                {top.slice(0, LOGOS_PER_CARD).map((t) => (
                  <span key={t.technologies.slug} title={t.technologies.name}>
                    <TechLogo
                      slug={t.technologies.slug}
                      name={t.technologies.name}
                      category={t.technologies.category}
                      size={26}
                    />
                  </span>
                ))}
                {total > LOGOS_PER_CARD ? (
                  <span className="more">+{total - LOGOS_PER_CARD}</span>
                ) : null}
              </div>
              <span className="muted small">
                {total} technologies · {new Date(r.created_at).toLocaleDateString()}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
