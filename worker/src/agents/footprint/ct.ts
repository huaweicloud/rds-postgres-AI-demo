import { z } from "zod";
import type { Db } from "../../db.js";
import { fetchJson, withRetry } from "../../net.js";

// Subdomains from certificate transparency logs. These names are only ever DNS-resolved,
// never fetched: StackDowser stays passive.

export const MAX_SUBDOMAINS = 200;

const crtshSchema = z.array(z.object({ name_value: z.string() }));
const certspotterSchema = z.array(z.object({ dns_names: z.array(z.string()) }));

export interface CtResult {
  hosts: string[];
  source: "crt.sh" | "certspotter";
  sourceUrl: string;
  totalFound: number;
}

export function cleanHosts(names: string[], domain: string): string[] {
  const apex = domain.toLowerCase();
  const out = new Set<string>();
  for (const raw of names) {
    for (const part of raw.split(/\s+/)) {
      const host = part.trim().toLowerCase().replace(/^\*\./, "").replace(/\.$/, "");
      if (!host || host === apex || !host.endsWith("." + apex)) continue;
      if (!/^[a-z0-9.-]+$/.test(host)) continue;
      out.add(host);
    }
  }
  return [...out];
}

// Large organizations have thousands of names. Keep the ones most likely to say something:
// short names first (api., grafana.), then alphabetical so the cut is stable between runs.
export function pickHosts(hosts: string[], limit = MAX_SUBDOMAINS): string[] {
  return [...hosts]
    .sort(
      (a, b) =>
        a.split(".").length - b.split(".").length || a.length - b.length || a.localeCompare(b),
    )
    .slice(0, limit);
}

export async function subdomainsFromCt(domain: string, signal?: AbortSignal): Promise<CtResult> {
  const crtUrl = `https://crt.sh/?q=${encodeURIComponent("%." + domain)}&output=json&exclude=expired`;
  try {
    const rows = crtshSchema.parse(
      // No retry: when crt.sh is slow it stays slow, and the fallback is quicker.
      await fetchJson(crtUrl, { timeoutMs: 12_000, signal }),
    );
    const hosts = cleanHosts(
      rows.map((r) => r.name_value),
      domain,
    );
    return {
      hosts: pickHosts(hosts),
      source: "crt.sh",
      sourceUrl: `https://crt.sh/?q=${domain}`,
      totalFound: hosts.length,
    };
  } catch (err) {
    if (signal?.aborted) throw err;
  }

  // crt.sh is often overloaded for big domains; Cert Spotter reads the same logs.
  const csUrl = `https://api.certspotter.com/v1/issuances?domain=${encodeURIComponent(domain)}&include_subdomains=true&expand=dns_names`;
  const rows = certspotterSchema.parse(
    await withRetry(() => fetchJson(csUrl, { timeoutMs: 15_000, signal }), 1),
  );
  const hosts = cleanHosts(
    rows.flatMap((r) => r.dns_names),
    domain,
  );
  return {
    hosts: pickHosts(hosts),
    source: "certspotter",
    sourceUrl: `https://sslmate.com/certspotter/?q=${domain}`,
    totalFound: hosts.length,
  };
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Both CT services can take tens of seconds (or fail) for big domains, so a result is kept
// for a day in page_cache under a ct: key. Pre-running demo companies warms it.
export async function cachedSubdomains(
  db: Db,
  domain: string,
  signal?: AbortSignal,
): Promise<CtResult> {
  const key = `ct:${domain}`;
  const { data } = await db
    .from("page_cache")
    .select("content_text, fetched_at")
    .eq("url", key)
    .maybeSingle();
  if (data?.content_text && Date.now() - new Date(data.fetched_at).getTime() < CACHE_TTL_MS) {
    return JSON.parse(data.content_text) as CtResult;
  }
  const result = await subdomainsFromCt(domain, signal);
  await db.from("page_cache").upsert({
    url: key,
    status: 200,
    content_text: JSON.stringify(result),
    fetched_at: new Date().toISOString(),
  });
  return result;
}
