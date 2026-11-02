"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSupabase } from "@/lib/browser";

interface Row {
  company_id: string;
  created_at: string;
  companies: { name: string; domain: string | null; logo_url: string | null } | null;
}

// The RLS showcase: the same query returns a different list for each signed-in user.
export default function WatchlistPage() {
  const { supabase, session } = useSupabase();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!session) return setRows(null);
    void supabase
      .from("watchlist")
      .select("company_id, created_at, companies(name, domain, logo_url)")
      .order("created_at", { ascending: false })
      .then(({ data }) => setRows((data as unknown as Row[]) ?? []));
  }, [supabase, session]);

  return (
    <section className="recent">
      <h1>Watchlist</h1>
      {!session ? <p className="muted">Sign in to see your watchlist.</p> : null}
      {rows && !rows.length ? <p className="muted">Nothing saved yet.</p> : null}
      <ul>
        {rows?.map((r) => (
          <li key={r.company_id}>
            <Link href={`/companies/${r.company_id}`}>
              {r.companies?.logo_url ? (
                <img src={r.companies.logo_url} alt="" width={16} height={16} />
              ) : null}
              <strong>{r.companies?.name}</strong>
              <span className="muted">{r.companies?.domain}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
