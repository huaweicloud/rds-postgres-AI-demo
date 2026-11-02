import { Resolver } from "node:dns/promises";

export interface ResolvedHost {
  host: string;
  // Each hop of the CNAME chain, in order.
  cnames: string[];
  addresses: string[];
}

const NO_RECORD = new Set([
  "ENODATA",
  "ENOTFOUND",
  "ESERVFAIL",
  "EREFUSED",
  "ETIMEOUT",
  "ECONNREFUSED",
]);

export class Dns {
  private resolver = new Resolver({ timeout: 2_500, tries: 2 });

  private async safe<T>(fn: () => Promise<T>, empty: T): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code && NO_RECORD.has(code)) return empty;
      throw err;
    }
  }

  mx(domain: string) {
    return this.safe(() => this.resolver.resolveMx(domain), []);
  }

  txt(domain: string) {
    return this.safe(
      async () => (await this.resolver.resolveTxt(domain)).map((chunks) => chunks.join("")),
      [] as string[],
    );
  }

  ns(domain: string) {
    return this.safe(() => this.resolver.resolveNs(domain), []);
  }

  // Follows the CNAME chain by hand (resolveCname returns one hop), then the addresses.
  async resolve(host: string): Promise<ResolvedHost> {
    const cnames: string[] = [];
    let current = host;
    for (let hop = 0; hop < 6; hop++) {
      const next = await this.safe(() => this.resolver.resolveCname(current), []);
      if (!next[0] || cnames.includes(next[0])) break;
      cnames.push(next[0]);
      current = next[0];
    }
    const [v4, v6] = await Promise.all([
      this.safe(() => this.resolver.resolve4(current), []),
      this.safe(() => this.resolver.resolve6(current), []),
    ]);
    return { host, cnames, addresses: [...v4, ...v6.slice(0, 2)] };
  }
}
