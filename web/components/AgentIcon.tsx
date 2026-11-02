import type { Agent } from "@stackdowser/db";

const PATHS: Record<Agent, string[]> = {
  footprint: [
    "M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18z",
    "M3 12h18",
    "M12 3c3 3 3 15 0 18c-3-3-3-15 0-18",
  ],
  jobs: [
    "M4 8h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z",
    "M9 8V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V8",
    "M4 13h16",
  ],
  blog: [
    "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z",
    "M14 3v5h5",
    "M9 13h6",
    "M9 17h4",
  ],
};

export function AgentIcon({ agent, size = 18 }: { agent: Agent; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {PATHS[agent].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

// The dowsing rod: a forked stick that points at what's underneath.
export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden>
      <rect width="32" height="32" rx="8" style={{ fill: "var(--accent)" }} />
      <path
        d="M9 7l7 9l7-9M16 16v6"
        fill="none"
        style={{ stroke: "var(--on-accent)" }}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11 25.5c3-1.6 7-1.6 10 0"
        fill="none"
        style={{ stroke: "var(--on-accent)" }}
        strokeOpacity=".6"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
