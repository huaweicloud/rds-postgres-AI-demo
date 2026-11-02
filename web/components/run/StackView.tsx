import { AGENT_LABELS, CORROBORATED_MIN_AGENTS, MAIN_VIEW_MIN_SCORE } from "@stackdowser/db";
import { useState } from "react";
import { CATEGORY_ORDER, categoryMeta } from "@/lib/categories";
import { TechLogo } from "../TechLogo";
import { EvidenceCard } from "./EvidenceCard";
import type { Evidence, StackRow } from "./types";

const STATUS_LABEL: Record<string, string> = {
  in_use: "in use",
  hiring_for: "hiring for",
  migrated_away: "migrated away",
  mentioned: "mentioned",
};

function TechItem({ row, onOpen }: { row: StackRow; onOpen: () => void }) {
  const t = row.technologies;
  return (
    <button className={`tech ${row.status}`} onClick={onOpen}>
      <TechLogo slug={t.slug} name={t.name} category={t.category} />
      <span className="tech-text">
        <span className="tech-name">{t.name}</span>
        <span className="tech-meta">
          {row.status !== "in_use" ? (
            <span className={`status ${row.status}`}>{STATUS_LABEL[row.status]}</span>
          ) : null}
          {row.agent_count >= CORROBORATED_MIN_AGENTS ? (
            <span className="badge">corroborated</span>
          ) : null}
          <span className="muted">
            {row.evidence_count} {row.evidence_count === 1 ? "source" : "sources"}
          </span>
        </span>
      </span>
      <span className="meter" title={`score ${row.score.toFixed(2)}`}>
        <span className="meter-bar" style={{ ["--s" as string]: row.score }} />
        <span className="meter-num">{Math.round(row.score * 100)}</span>
      </span>
    </button>
  );
}

function Drawer({
  row,
  evidence,
  onClose,
}: {
  row: StackRow;
  evidence: Evidence[];
  onClose: () => void;
}) {
  const t = row.technologies;
  const mine = evidence.filter((e) => e.technology_id === row.technology_id);
  const agents = [...new Set(mine.map((e) => e.agent))];
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <header>
          <TechLogo slug={t.slug} name={t.name} category={t.category} size={44} />
          <div>
            <h2>{t.name}</h2>
            <p className="muted small">
              {categoryMeta(t.category).label} · {STATUS_LABEL[row.status]} · score{" "}
              {Math.round(row.score * 100)}
            </p>
          </div>
          <button className="link" onClick={onClose}>
            Close
          </button>
        </header>
        <p className="muted small">
          {mine.length} {mine.length === 1 ? "piece" : "pieces"} of evidence from{" "}
          {agents.map((a) => AGENT_LABELS[a]).join(", ")}
        </p>
        <div className="cards">
          {mine.map((e) => (
            <EvidenceCard key={e.id} e={e} />
          ))}
        </div>
      </aside>
    </div>
  );
}

function Category({
  category,
  rows,
  onOpen,
}: {
  category: string;
  rows: StackRow[];
  onOpen: (r: StackRow) => void;
}) {
  const meta = categoryMeta(category);
  return (
    <section className="category" style={{ ["--cat" as string]: meta.color }}>
      <h3>
        <span className="cat-dot" />
        {meta.label}
        <span className="cat-count">{rows.length}</span>
      </h3>
      <div className="tech-list">
        {rows.map((r) => (
          <TechItem key={r.technology_id} row={r} onOpen={() => onOpen(r)} />
        ))}
      </div>
    </section>
  );
}

export function StackView({ stack, evidence }: { stack: StackRow[]; evidence: Evidence[] }) {
  const [open, setOpen] = useState<StackRow | null>(null);
  const main = stack.filter((r) => r.score >= MAIN_VIEW_MIN_SCORE && r.status !== "migrated_away");
  const weak = stack.filter((r) => r.score < MAIN_VIEW_MIN_SCORE);
  const gone = stack.filter((r) => r.score >= MAIN_VIEW_MIN_SCORE && r.status === "migrated_away");

  return (
    <div className="stack">
      <div className="categories">
        {CATEGORY_ORDER.filter((c) => main.some((r) => r.technologies.category === c)).map((c) => (
          <Category
            key={c}
            category={c}
            rows={main.filter((r) => r.technologies.category === c)}
            onOpen={setOpen}
          />
        ))}
      </div>
      {gone.length ? (
        <section className="category gone">
          <h3>
            Migrated away from<span className="cat-count">{gone.length}</span>
          </h3>
          <div className="tech-list">
            {gone.map((r) => (
              <TechItem key={r.technology_id} row={r} onOpen={() => setOpen(r)} />
            ))}
          </div>
        </section>
      ) : null}
      {weak.length ? (
        <details className="weak">
          <summary>
            Weak signals{" "}
            <span className="muted">
              ({weak.length}, score below {Math.round(MAIN_VIEW_MIN_SCORE * 100)})
            </span>
          </summary>
          <div className="tech-list cols">
            {weak.map((r) => (
              <TechItem key={r.technology_id} row={r} onOpen={() => setOpen(r)} />
            ))}
          </div>
        </details>
      ) : null}
      {open ? <Drawer row={open} evidence={evidence} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}
