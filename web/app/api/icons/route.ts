import { NextResponse } from "next/server";
import { z } from "zod";
import { findTechIcon, type TechIcon } from "@/lib/tech-icons";

export const runtime = "nodejs";

const bodySchema = z.object({
  items: z.array(z.object({ slug: z.string().max(120), name: z.string().max(200) })).max(400),
});

// Logos for a batch of technologies, so the browser never downloads the whole icon set.
// A null entry means "no logo": the client draws a monogram instead.
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid request" }, { status: 400 });
  const icons: Record<string, TechIcon | null> = {};
  for (const { slug, name } of parsed.data.items) icons[slug] = findTechIcon(slug, name);
  return NextResponse.json({ icons }, { headers: { "cache-control": "private, max-age=3600" } });
}
