import ipaddr from "ipaddr.js";
import { z } from "zod";
import type { Logger } from "../../log.js";
import { fetchJson, withRetry } from "../../net.js";
import { TECH, type Tech } from "./rules.js";

// Published IP range files, refreshed daily. Each prefix maps to the provider (and, for
// AWS, the service) that owns it.

export interface Prefix {
  network: ipaddr.IPv4 | ipaddr.IPv6;
  bits: number;
  tech: Tech;
  label: string;
  source: string;
}

export interface RangeSource {
  name: string;
  url: string;
  load(): Promise<Prefix[]>;
}

const AWS_SERVICE_TECH: Record<string, Tech> = {
  CLOUDFRONT: TECH.cloudfront,
  S3: TECH.s3,
  API_GATEWAY: TECH.apiGateway,
};

function prefix(cidr: string, tech: Tech, label: string, source: string): Prefix | null {
  try {
    const [network, bits] = ipaddr.parseCIDR(cidr.trim());
    return { network, bits, tech, label, source };
  } catch {
    return null;
  }
}

const awsSchema = z.object({
  prefixes: z.array(z.object({ ip_prefix: z.string(), service: z.string(), region: z.string() })),
  ipv6_prefixes: z.array(
    z.object({ ipv6_prefix: z.string(), service: z.string(), region: z.string() }),
  ),
});

const googleSchema = z.object({
  prefixes: z.array(
    z.object({
      ipv4Prefix: z.string().optional(),
      ipv6Prefix: z.string().optional(),
      scope: z.string().optional(),
    }),
  ),
});

const oracleSchema = z.object({
  regions: z.array(
    z.object({ region: z.string(), cidrs: z.array(z.object({ cidr: z.string() })) }),
  ),
});

const fastlySchema = z.object({
  addresses: z.array(z.string()),
  ipv6_addresses: z.array(z.string()),
});

async function text(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

export const RANGE_SOURCES: RangeSource[] = [
  {
    name: "AWS",
    url: "https://ip-ranges.amazonaws.com/ip-ranges.json",
    async load() {
      const data = awsSchema.parse(await fetchJson(this.url, { timeoutMs: 20_000 }));
      const rows = [
        ...data.prefixes.map((p) => ({ cidr: p.ip_prefix, service: p.service, region: p.region })),
        ...data.ipv6_prefixes.map((p) => ({
          cidr: p.ipv6_prefix,
          service: p.service,
          region: p.region,
        })),
      ];
      return rows
        .map((r) =>
          prefix(
            r.cidr,
            AWS_SERVICE_TECH[r.service] ?? TECH.aws,
            `AWS ${r.service} ${r.region}`,
            this.url,
          ),
        )
        .filter((p): p is Prefix => p !== null);
    },
  },
  {
    name: "Google Cloud",
    url: "https://www.gstatic.com/ipranges/cloud.json",
    async load() {
      const data = googleSchema.parse(await fetchJson(this.url, { timeoutMs: 20_000 }));
      return data.prefixes
        .map((p) => {
          const cidr = p.ipv4Prefix ?? p.ipv6Prefix;
          return cidr
            ? prefix(cidr, TECH.gcp, `Google Cloud ${p.scope ?? ""}`.trim(), this.url)
            : null;
        })
        .filter((p): p is Prefix => p !== null);
    },
  },
  {
    name: "Cloudflare",
    url: "https://www.cloudflare.com/ips-v4",
    async load() {
      const lines = [
        ...(await text("https://www.cloudflare.com/ips-v4")).split("\n"),
        ...(await text("https://www.cloudflare.com/ips-v6")).split("\n"),
      ];
      return lines
        .filter((l) => l.trim())
        .map((l) => prefix(l, TECH.cloudflare, "Cloudflare", this.url))
        .filter((p): p is Prefix => p !== null);
    },
  },
  {
    name: "Oracle Cloud",
    url: "https://docs.oracle.com/en-us/iaas/tools/public_ip_ranges.json",
    async load() {
      const data = oracleSchema.parse(await fetchJson(this.url, { timeoutMs: 20_000 }));
      return data.regions
        .flatMap((r) =>
          r.cidrs.map((c) =>
            prefix(c.cidr, TECH.oracleCloud, `Oracle Cloud ${r.region}`, this.url),
          ),
        )
        .filter((p): p is Prefix => p !== null);
    },
  },
  {
    name: "Fastly",
    url: "https://api.fastly.com/public-ip-list",
    async load() {
      const data = fastlySchema.parse(await fetchJson(this.url, { timeoutMs: 20_000 }));
      return [...data.addresses, ...data.ipv6_addresses]
        .map((c) => prefix(c, TECH.fastly, "Fastly", this.url))
        .filter((p): p is Prefix => p !== null);
    },
  },
  {
    name: "DigitalOcean",
    url: "https://digitalocean.com/geo/google.csv",
    async load() {
      const csv = await text(this.url);
      return csv
        .split("\n")
        .map((line) => line.split(",")[0] ?? "")
        .filter((c) => c.includes("/"))
        .map((c) => prefix(c, TECH.digitalocean, "DigitalOcean", this.url))
        .filter((p): p is Prefix => p !== null);
    },
  },
];

export interface IpMatch {
  tech: Tech;
  label: string;
  cidr: string;
  source: string;
}

// Longest-prefix match over buckets keyed by the first octet (IPv4) or first 16 bits (IPv6),
// which keeps each lookup to a few hundred comparisons instead of tens of thousands.
export class IpRangeIndex {
  private buckets = new Map<string, Prefix[]>();
  private wide: Prefix[] = [];

  constructor(prefixes: Prefix[]) {
    for (const p of prefixes) {
      const isV4 = p.network.kind() === "ipv4";
      const minBits = isV4 ? 8 : 16;
      if (p.bits < minBits) {
        this.wide.push(p);
        continue;
      }
      const key = this.keyFor(p.network);
      const list = this.buckets.get(key) ?? [];
      list.push(p);
      this.buckets.set(key, list);
    }
  }

  get size(): number {
    let n = this.wide.length;
    for (const list of this.buckets.values()) n += list.length;
    return n;
  }

  private keyFor(addr: ipaddr.IPv4 | ipaddr.IPv6): string {
    if (addr.kind() === "ipv4") return `4:${(addr as ipaddr.IPv4).octets[0]}`;
    return `6:${(addr as ipaddr.IPv6).parts[0]}`;
  }

  match(ip: string): IpMatch | null {
    let addr: ipaddr.IPv4 | ipaddr.IPv6;
    try {
      addr = ipaddr.parse(ip);
      if (addr.kind() === "ipv6" && (addr as ipaddr.IPv6).isIPv4MappedAddress()) {
        addr = (addr as ipaddr.IPv6).toIPv4Address();
      }
    } catch {
      return null;
    }
    const candidates = [...(this.buckets.get(this.keyFor(addr)) ?? []), ...this.wide];
    let best: Prefix | null = null;
    for (const p of candidates) {
      if (p.network.kind() !== addr.kind()) continue;
      if (addr.match([p.network, p.bits] as never) && (!best || p.bits > best.bits)) best = p;
    }
    if (!best) return null;
    return {
      tech: best.tech,
      label: best.label,
      cidr: `${best.network.toString()}/${best.bits}`,
      source: best.source,
    };
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

export class IpRanges {
  private index: IpRangeIndex | null = null;
  private loadedAt = 0;
  private loading: Promise<IpRangeIndex> | null = null;

  constructor(
    private readonly log: Logger,
    private readonly sources: RangeSource[] = RANGE_SOURCES,
  ) {}

  // A failed source is skipped, not fatal: the other providers still match.
  private async refresh(): Promise<IpRangeIndex> {
    const results = await Promise.allSettled(this.sources.map((s) => withRetry(() => s.load())));
    const prefixes: Prefix[] = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled") prefixes.push(...r.value);
      else
        this.log.warn("ip range source failed", {
          source: this.sources[i]!.name,
          error: String(r.reason),
        });
    });
    this.index = new IpRangeIndex(prefixes);
    this.loadedAt = Date.now();
    this.log.info("ip ranges loaded", { prefixes: this.index.size });
    return this.index;
  }

  async get(): Promise<IpRangeIndex> {
    if (this.index && Date.now() - this.loadedAt < DAY_MS) return this.index;
    this.loading ??= this.refresh().finally(() => {
      this.loading = null;
    });
    return this.index ?? this.loading;
  }
}
