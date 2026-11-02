import type { Evidence } from "./types";

// dns: references aren't browsable; show them as the record they quote.
export function SourceLink({ url, title }: { url: string; title?: string | null }) {
  if (!url.startsWith("http")) return <code className="source">{url}</code>;
  let host = url;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // Keep the raw URL.
  }
  return (
    <a className="source" href={url} target="_blank" rel="noreferrer noopener" title={title ?? url}>
      {host}
    </a>
  );
}

export function EvidenceCard({ e }: { e: Evidence }) {
  return (
    <article className="card">
      <header>
        <strong>{e.raw_name}</strong>
        {e.category ? <span className="tag">{e.category}</span> : null}
        {e.usage && e.usage !== "in_use" ? (
          <span className="tag soft">{e.usage.replace("_", " ")}</span>
        ) : null}
      </header>
      <blockquote>{e.snippet}</blockquote>
      <footer>
        <SourceLink url={e.source_url} title={e.source_title} />
        {e.published_at ? <span className="muted small">{e.published_at}</span> : null}
        <span className="confidence" title={`confidence ${e.confidence.toFixed(2)}`}>
          <span style={{ width: `${Math.round(e.confidence * 100)}%` }} />
        </span>
      </footer>
    </article>
  );
}
