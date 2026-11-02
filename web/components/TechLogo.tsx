"use client";

import { useEffect, useState } from "react";
import { categoryMeta, initials } from "@/lib/categories";

type Icon =
  | { kind: "path"; hex: string; path: string }
  | { kind: "svg"; body: string; width: number; height: number };

// One request per burst of logos: every TechLogo that mounts in the same tick is resolved
// together, and the answers are kept for the rest of the session.
const known = new Map<string, Icon | null>();
const waiting = new Map<string, { slug: string; name: string; done: Array<() => void> }>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  flushTimer = null;
  const batch = [...waiting.values()];
  waiting.clear();
  void fetch("/api/icons", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items: batch.map(({ slug, name }) => ({ slug, name })) }),
  })
    .then((r) => (r.ok ? r.json() : { icons: {} }))
    .catch(() => ({ icons: {} }))
    .then(({ icons }: { icons: Record<string, Icon | null> }) => {
      for (const b of batch) {
        known.set(b.slug, icons[b.slug] ?? null);
        b.done.forEach((f) => f());
      }
    });
}

function request(slug: string, name: string, done: () => void) {
  const w = waiting.get(slug) ?? { slug, name, done: [] };
  w.done.push(done);
  waiting.set(slug, w);
  flushTimer ??= setTimeout(flush, 0);
}

export function TechLogo({
  slug,
  name,
  category,
  size = 28,
}: {
  slug: string;
  name: string;
  category: string;
  size?: number;
}) {
  const [icon, setIcon] = useState<Icon | null | undefined>(() => known.get(slug));

  useEffect(() => {
    if (known.has(slug)) return setIcon(known.get(slug));
    let live = true;
    request(slug, name, () => live && setIcon(known.get(slug)));
    return () => {
      live = false;
    };
  }, [slug, name]);

  const style = { width: size, height: size, ["--cat" as string]: categoryMeta(category).color };
  if (icon === undefined) return <span className="tlogo" style={style} aria-hidden />;
  if (!icon) {
    return (
      <span className="tlogo mono" style={style} aria-hidden>
        <span style={{ fontSize: Math.round(size * 0.4) }}>{initials(name)}</span>
      </span>
    );
  }
  return (
    <span className="tlogo" style={style} aria-hidden>
      {icon.kind === "path" ? (
        <svg viewBox="0 0 24 24" fill={`#${icon.hex}`} width="62%" height="62%">
          <path d={icon.path} />
        </svg>
      ) : (
        // The body comes from the pinned Iconify package on our server, never from user input.
        <svg
          viewBox={`0 0 ${icon.width} ${icon.height}`}
          width="62%"
          height="62%"
          dangerouslySetInnerHTML={{ __html: icon.body }}
        />
      )}
    </span>
  );
}
