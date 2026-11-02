import type { NewEvidence } from "@stackdowser/db";
import type { IpRangeIndex } from "./ipranges.js";
import type { ResolvedHost } from "./dns.js";
import {
  HEADER_RULES,
  HTML_RULES,
  MX_SUFFIXES,
  SPF_INCLUDES,
  SUBDOMAIN_HINTS,
  TXT_VERIFICATIONS,
  matchNameServer,
  matchSuffix,
  type Tech,
} from "./rules.js";

// The snippet of a DNS finding is the record itself, written the way dig prints it, and
// the source is a dns: reference anyone can re-check.

function finding(
  tech: Tech,
  confidence: number,
  sourceUrl: string,
  sourceTitle: string,
  snippet: string,
): NewEvidence {
  return {
    raw_name: tech.name,
    category: tech.category,
    usage: "in_use",
    confidence,
    source_url: sourceUrl,
    source_title: sourceTitle,
    snippet: snippet.slice(0, 600),
    published_at: null,
  };
}

export function fromMx(
  domain: string,
  records: { exchange: string; priority: number }[],
): NewEvidence[] {
  const out: NewEvidence[] = [];
  for (const r of records) {
    const rule = matchSuffix(r.exchange, MX_SUFFIXES);
    if (rule) {
      out.push(
        finding(
          rule.tech,
          0.95,
          `dns:${domain}?type=MX`,
          "DNS MX record",
          `${domain}. MX ${r.priority} ${r.exchange}.`,
        ),
      );
    }
  }
  return out;
}

export function fromTxt(domain: string, records: string[]): NewEvidence[] {
  const out: NewEvidence[] = [];
  for (const txt of records) {
    const record = `${domain}. TXT "${txt.length > 300 ? txt.slice(0, 300) + "…" : txt}"`;
    if (/^v=spf1/i.test(txt)) {
      for (const rule of SPF_INCLUDES) {
        if (rule.pattern.test(txt)) {
          out.push(finding(rule.tech, 0.85, `dns:${domain}?type=TXT`, "SPF record", record));
        }
      }
      continue;
    }
    for (const rule of TXT_VERIFICATIONS) {
      if (rule.pattern.test(txt)) {
        // A verification token proves an account was connected once, not that it's still used.
        out.push(
          finding(rule.tech, 0.7, `dns:${domain}?type=TXT`, "Domain verification record", record),
        );
        break;
      }
    }
  }
  return out;
}

export function fromNs(domain: string, records: string[]): NewEvidence[] {
  const out: NewEvidence[] = [];
  for (const ns of records) {
    const tech = matchNameServer(ns);
    if (tech)
      out.push(
        finding(tech, 0.9, `dns:${domain}?type=NS`, "DNS NS record", `${domain}. NS ${ns}.`),
      );
  }
  return out;
}

export function fromHost(resolved: ResolvedHost, index: IpRangeIndex | null): NewEvidence[] {
  const out: NewEvidence[] = [];
  const { host, cnames, addresses } = resolved;
  let cnameMatched = false;

  let prev = host;
  for (const target of cnames) {
    const rule = matchSuffix(target);
    if (rule) {
      out.push(
        finding(
          rule.tech,
          0.95,
          `dns:${host}?type=CNAME`,
          "DNS CNAME record",
          `${prev}. CNAME ${target}.`,
        ),
      );
      cnameMatched = true;
    }
    prev = target;
  }

  // An address only adds something when the CNAME didn't already name the provider.
  if (!cnameMatched && index) {
    for (const ip of addresses) {
      const m = index.match(ip);
      if (m) {
        const type = ip.includes(":") ? "AAAA" : "A";
        out.push(
          finding(
            m.tech,
            0.9,
            `dns:${host}?type=${type}`,
            `DNS ${type} record in published ${m.label} range`,
            `${prev}. ${type} ${ip} (in ${m.cidr}, ${m.label})`,
          ),
        );
        break;
      }
    }
  }
  return out;
}

export function fromSubdomainName(host: string, domain: string, ctUrl: string): NewEvidence[] {
  const label = host.slice(0, -(domain.length + 1)).split(".")[0] ?? "";
  for (const hint of SUBDOMAIN_HINTS) {
    if (hint.label.test(label)) {
      // A hostname suggests a self-hosted tool but we never look at it, so keep it weak.
      return [finding(hint.tech, 0.5, ctUrl, "Certificate transparency log", host)];
    }
  }
  return [];
}

export function fromHeaders(url: string, headers: Headers): NewEvidence[] {
  const out: NewEvidence[] = [];
  const seen = new Set<string>();
  for (const rule of HEADER_RULES) {
    const value = headers.get(rule.header);
    if (value === null) continue;
    if (rule.pattern && !rule.pattern.test(value)) continue;
    if (seen.has(rule.tech.name)) continue;
    seen.add(rule.tech.name);
    out.push(
      finding(
        rule.tech,
        0.9,
        url,
        "HTTP response headers",
        `${rule.header}: ${value.slice(0, 200)}`,
      ),
    );
  }
  return out;
}

export function fromHtml(url: string, html: string): NewEvidence[] {
  const out: NewEvidence[] = [];
  for (const rule of HTML_RULES) {
    const m = rule.pattern.exec(html);
    if (!m) continue;
    // Quote the markup around the match so the snippet is checkable in view-source.
    const start = Math.max(0, m.index - 40);
    const end = Math.min(html.length, m.index + m[0].length + 40);
    const snippet = html.slice(start, end).replace(/\s+/g, " ").trim();
    out.push(finding(rule.tech, 0.85, url, "Homepage HTML", snippet));
  }
  return out;
}
