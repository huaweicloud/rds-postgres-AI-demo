import type { Technology } from "@stackdowser/db";

// "PostgreSQL 15" → "postgresql", "Python 3.x" → "python", "React.js v18" → "react.js".
// Version tokens go; names that are only digits ("1Password", "C++") are kept intact.
export function normalizeName(raw: string): string {
  let s = raw.toLowerCase().normalize("NFKC").trim();
  s = s.replace(/\(.*?\)/g, " ");
  s = s.replace(/\s+v?\d+(\.\d+|\.x)*\+?(?=\s|$)/g, " ");
  s = s.replace(/[™®]/g, "");
  return s.replace(/\s+/g, " ").trim();
}

// "Stripe Checkout" on Stripe's own blog is a product, not part of the stack it runs on.
export function isOwnProduct(raw: string, companyName: string): boolean {
  const name = normalizeName(raw);
  const own = normalizeName(companyName);
  return (
    own.length > 0 && (name === own || [" ", ".", "-"].some((sep) => name.startsWith(own + sep)))
  );
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/\+/g, "p")
      .replace(/#/g, "sharp")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "tech"
  );
}

export class AliasIndex {
  private map = new Map<string, Technology>();

  constructor(technologies: Technology[]) {
    for (const t of technologies) this.add(t);
  }

  add(t: Technology): void {
    for (const key of [t.slug, normalizeName(t.name), ...t.aliases.map(normalizeName)]) {
      if (key && !this.map.has(key)) this.map.set(key, t);
    }
  }

  lookup(raw: string): Technology | null {
    const n = normalizeName(raw);
    return (
      this.map.get(n) ??
      this.map.get(n.replace(/\.js$/, "")) ??
      this.map.get(n.replace(/^(apache|amazon|aws|google|microsoft|azure) /, "")) ??
      null
    );
  }
}
