import type { NewEvidence } from "@stackdowser/db";
import pLimit from "p-limit";
import { errorMessage } from "../../log.js";
import type { AgentFn } from "../types.js";
import {
  fromHeaders,
  fromHost,
  fromHtml,
  fromMx,
  fromNs,
  fromSubdomainName,
  fromTxt,
} from "./analyze.js";
import { cachedSubdomains } from "./ct.js";
import { Dns } from "./dns.js";

// The same CDN on 150 subdomains is one fact, not 150. Keep a few rows per technology so the
// lane stays readable and the score still sees independent records.
const MAX_ROWS_PER_TECH = 4;

export const footprintAgent: AgentFn = async (ctx) => {
  const domain = ctx.target.domain;
  if (!domain) {
    await ctx.step("no domain to look up");
    return;
  }
  const dns = new Dns();
  const perTech = new Map<string, number>();
  const perRecord = new Set<string>();
  // A company's own product shows up in its own DNS (Stripe's stripe-verification record).
  const own = new Set([ctx.target.companyName.toLowerCase(), domain.split(".")[0]!]);

  const emitAll = async (findings: NewEvidence[]) => {
    for (const f of findings) {
      if (own.has(f.raw_name.toLowerCase())) continue;
      // Four MX hosts for Google Workspace are one fact: one row per record set.
      const recordKey = `${f.raw_name}|${f.source_url}`;
      if (perRecord.has(recordKey)) continue;
      const n = perTech.get(f.raw_name) ?? 0;
      if (n >= MAX_ROWS_PER_TECH) continue;
      perRecord.add(recordKey);
      perTech.set(f.raw_name, n + 1);
      await ctx.emit(f);
    }
  };

  const apexRecords = async () => {
    await ctx.step(`DNS records for ${domain}`);
    const [mx, txt, ns, apex, www] = await Promise.all([
      dns.mx(domain),
      dns.txt(domain),
      dns.ns(domain),
      dns.resolve(domain),
      dns.resolve(`www.${domain}`),
    ]);
    const index = await ctx.services.ipRanges.get().catch(() => null);
    await emitAll([...fromMx(domain, mx), ...fromNs(domain, ns), ...fromTxt(domain, txt)]);
    await emitAll([...fromHost(apex, index), ...fromHost(www, index)]);
  };

  const homepage = async () => {
    if (!ctx.budget.tryTake("pages")) return;
    try {
      const res = await ctx.services.fetcher.raw(`https://${domain}/`, { signal: ctx.signal });
      await emitAll(fromHeaders(res.url, res.headers));
      if ((res.headers.get("content-type") ?? "").includes("html"))
        await emitAll(fromHtml(res.url, res.body));
    } catch (err) {
      ctx.log.warn("homepage fetch failed", { error: errorMessage(err) });
    }
  };

  const subdomains = async () => {
    await ctx.step("certificate transparency logs");
    const ct = await cachedSubdomains(ctx.services.db, domain, ctx.signal);
    await ctx.step(`resolving ${ct.hosts.length} of ${ct.totalFound} subdomains from ${ct.source}`);
    const index = await ctx.services.ipRanges.get().catch(() => null);
    const limit = pLimit(20);
    await Promise.all(
      ct.hosts.map((host) =>
        limit(async () => {
          if (ctx.signal.aborted) return;
          const findings = fromSubdomainName(host, domain, ct.sourceUrl);
          try {
            findings.push(...fromHost(await dns.resolve(host), index));
          } catch {
            // One unresolvable name says nothing; skip it.
          }
          await emitAll(findings);
        }),
      ),
    );
  };

  // Run the three in parallel: the apex records land in a second or two, which is what puts
  // the first card on screen fast.
  const results = await Promise.allSettled([apexRecords(), homepage(), subdomains()]);
  const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  for (const f of failed) ctx.log.warn("footprint step failed", { error: errorMessage(f.reason) });
  if (failed.length === results.length) throw failed[0]!.reason;
};
