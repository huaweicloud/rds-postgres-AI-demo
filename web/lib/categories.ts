import type { Category } from "@stackdowser/db";

// Display names and colours for the dictionary's categories, shared by the page and the PDF.
export const CATEGORY_META: Record<Category, { label: string; color: string }> = {
  cloud: { label: "Cloud & hosting", color: "#2f6690" },
  infra: { label: "Infrastructure & edge", color: "#4c5a8c" },
  language: { label: "Languages", color: "#7b4570" },
  frontend: { label: "Frontend", color: "#a13d3d" },
  backend: { label: "Backend", color: "#7a6420" },
  database: { label: "Databases", color: "#1f6b66" },
  data: { label: "Data & analytics", color: "#4d7330" },
  messaging: { label: "Messaging & queues", color: "#b0581f" },
  devops: { label: "DevOps", color: "#5c6b2a" },
  observability: { label: "Observability", color: "#96700f" },
  ml: { label: "ML & AI", color: "#61518f" },
  saas: { label: "SaaS & business tools", color: "#6a6458" },
};

// Infrastructure first: it's what a Solution Architect reads first.
export const CATEGORY_ORDER: Category[] = [
  "cloud",
  "infra",
  "database",
  "data",
  "messaging",
  "backend",
  "language",
  "frontend",
  "devops",
  "observability",
  "ml",
  "saas",
];

export function categoryMeta(category: string) {
  return CATEGORY_META[category as Category] ?? { label: category, color: "#6a6458" };
}

// Brands whose logos aren't available get a readable short form instead of two letters.
const FAMILIES: [RegExp, string][] = [
  [/^(amazon|aws)\b/i, "aws"],
  [/^azure\b|\bazure\b/i, "Az"],
  [/^microsoft\b/i, "MS"],
  [/^oracle\b/i, "Or"],
];

export function initials(name: string): string {
  const family = FAMILIES.find(([re]) => re.test(name));
  if (family) return family[1];
  const words = name
    .replace(/[^\p{L}\p{N}\s.+#-]/gu, "")
    .split(/[\s.-]+/)
    .filter(Boolean);
  if (words.length > 1) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  return name.slice(0, 2).replace(/^./, (c) => c.toUpperCase());
}
