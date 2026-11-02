import "server-only";
import {
  Document,
  Link,
  Page,
  Path,
  StyleSheet,
  Svg,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import {
  AGENT_LABELS,
  CORROBORATED_MIN_AGENTS,
  MAIN_VIEW_MIN_SCORE,
  type Agent,
} from "@stackdowser/db";
import { CATEGORY_ORDER, categoryMeta, initials } from "./categories";
import { svgChildren } from "./pdf-svg";
import { findTechIcon } from "./tech-icons";

export interface ReportTech {
  name: string;
  slug: string;
  category: string;
  status: string;
  score: number;
  agentCount: number;
  evidence: { agent: Agent; snippet: string; source_url: string }[];
}

export interface ReportData {
  company: {
    name: string;
    domain: string | null;
    description: string | null;
    summary: string | null;
  };
  generatedAt: string;
  findings: number;
  sources: number;
  technologies: ReportTech[];
}

const INK = "#121412";
const MUTED = "#5d625e";
const LINE = "#dcdedb";
const ACCENT = "#17614a";
const SOFT = "#f0f1ef";

const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  in_use: { label: "in use", bg: "#e0eee8", fg: ACCENT },
  hiring_for: { label: "hiring for", bg: "#e6ebf3", fg: "#2f4f7a" },
  migrated_away: { label: "migrated away", bg: "#f6ead0", fg: "#8a5a00" },
  mentioned: { label: "mentioned", bg: SOFT, fg: MUTED },
};

const s = StyleSheet.create({
  page: { paddingBottom: 48, fontSize: 9, fontFamily: "Helvetica", color: INK },
  band: {
    backgroundColor: ACCENT,
    paddingHorizontal: 40,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  brand: { flexDirection: "row", alignItems: "center" },
  brandText: { color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 13, marginLeft: 8 },
  bandRight: { color: "#cfe5db", fontSize: 8.5, textAlign: "right" },
  body: { paddingHorizontal: 40 },
  company: { marginTop: 8 },
  h1: { fontSize: 24, fontFamily: "Helvetica-Bold", letterSpacing: -0.4 },
  sub: { color: MUTED, marginTop: 3, fontSize: 9.5, lineHeight: 1.4 },
  stats: { flexDirection: "row", marginTop: 16 },
  stat: {
    flex: 1,
    backgroundColor: SOFT,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginRight: 8,
  },
  statLabel: {
    color: MUTED,
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
  },
  statValue: { fontSize: 17, fontFamily: "Helvetica-Bold", marginTop: 2 },
  summary: {
    marginTop: 14,
    padding: 12,
    borderLeft: `3pt solid ${ACCENT}`,
    backgroundColor: "#f6f7f5",
    borderRadius: 4,
  },
  summaryLabel: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: MUTED,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  summaryText: { fontSize: 10, lineHeight: 1.5 },
  catHead: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 4,
    paddingBottom: 4,
    borderBottom: `1.5pt solid ${LINE}`,
  },
  catDot: { width: 7, height: 7, borderRadius: 3.5, marginRight: 6 },
  catLabel: { fontFamily: "Helvetica-Bold", fontSize: 10.5, flex: 1 },
  catCount: { fontSize: 8, color: MUTED },
  tech: { flexDirection: "row", paddingVertical: 6, borderBottom: `0.5pt solid ${LINE}` },
  logo: {
    width: 20,
    height: 20,
    borderRadius: 4,
    border: `0.5pt solid ${LINE}`,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  mono: { fontFamily: "Helvetica-Bold", fontSize: 7.5 },
  // A fixed width: react-pdf mis-measures wrapped text in a flexible column and spreads it.
  techMain: { width: 413 },
  techTop: { flexDirection: "row", alignItems: "center" },
  techName: { fontFamily: "Helvetica-Bold", fontSize: 10 },
  pill: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    paddingVertical: 1.5,
    paddingHorizontal: 4,
    borderRadius: 3,
    marginLeft: 5,
  },
  quote: { marginTop: 3, color: "#383c39" },
  source: { marginTop: 2, fontSize: 7.5, color: MUTED },
  link: { color: ACCENT, textDecoration: "none" },
  meter: { width: 62, alignItems: "flex-end", marginLeft: 10 },
  meterNum: { fontFamily: "Helvetica-Bold", fontSize: 9 },
  meterTrack: { width: 52, height: 3.5, backgroundColor: SOFT, borderRadius: 2, marginTop: 3 },
  weak: { marginTop: 16, padding: 10, border: `0.5pt dashed ${LINE}`, borderRadius: 4 },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: "#8a908b",
  },
});

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Logo({ t }: { t: ReportTech }) {
  const icon = findTechIcon(t.slug, t.name);
  const color = categoryMeta(t.category).color;
  const drawn = icon?.kind === "svg" ? svgChildren(icon.body) : null;
  if (!icon || (icon.kind === "svg" && !drawn)) {
    return (
      <View style={[s.logo, { backgroundColor: `${color}22`, border: "none" }]}>
        <Text style={[s.mono, { color }]}>{initials(t.name)}</Text>
      </View>
    );
  }
  return (
    <View style={s.logo}>
      {icon.kind === "path" ? (
        <Svg viewBox="0 0 24 24" width={12} height={12}>
          <Path d={icon.path} fill={`#${icon.hex}`} />
        </Svg>
      ) : (
        <Svg viewBox={`0 0 ${icon.width} ${icon.height}`} width={12} height={12}>
          {drawn}
        </Svg>
      )}
    </View>
  );
}

function Pill({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return <Text style={[s.pill, { backgroundColor: bg, color: fg }]}>{label.toUpperCase()}</Text>;
}

function TechRow({ t }: { t: ReportTech }) {
  const e = t.evidence[0];
  const color = categoryMeta(t.category).color;
  const status = STATUS[t.status] ?? STATUS.mentioned!;
  return (
    <View style={s.tech} wrap={false}>
      <Logo t={t} />
      <View style={s.techMain}>
        <View style={s.techTop}>
          <Text style={s.techName}>{t.name}</Text>
          {t.status !== "in_use" ? <Pill {...status} /> : null}
          {t.agentCount >= CORROBORATED_MIN_AGENTS ? (
            <Pill label="corroborated" bg="#e0eee8" fg={ACCENT} />
          ) : null}
        </View>
        {e ? (
          <>
            <Text style={s.quote}>“{e.snippet}”</Text>
            <Text style={s.source}>
              {AGENT_LABELS[e.agent]} ·{" "}
              {e.source_url.startsWith("http") ? (
                <Link src={e.source_url} style={s.link}>
                  {host(e.source_url)}
                </Link>
              ) : (
                e.source_url
              )}
              {t.evidence.length > 1 ? `  +${t.evidence.length - 1} more` : ""}
            </Text>
          </>
        ) : null}
      </View>
      <View style={s.meter}>
        <Text style={[s.meterNum, { color }]}>{Math.round(t.score * 100)}</Text>
        <View style={s.meterTrack}>
          <View
            style={{
              width: `${Math.round(t.score * 100)}%`,
              height: 3.5,
              borderRadius: 2,
              backgroundColor: color,
            }}
          />
        </View>
      </View>
    </View>
  );
}

function BrandMark() {
  return (
    <Svg viewBox="0 0 32 32" width={20} height={20}>
      <Path
        d="M8 0h16a8 8 0 0 1 8 8v16a8 8 0 0 1-8 8H8a8 8 0 0 1-8-8V8a8 8 0 0 1 8-8z"
        fill="#ffffff"
        fillOpacity={0.18}
      />
      <Path
        d="M9 7l7 9l7-9M16 16v6"
        stroke="#ffffff"
        strokeWidth={2.6}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M11 25.5c3-1.6 7-1.6 10 0"
        stroke="#ffffff"
        strokeOpacity={0.6}
        strokeWidth={1.8}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function Report({ data }: { data: ReportData }) {
  const main = data.technologies.filter((t) => t.score >= MAIN_VIEW_MIN_SCORE);
  const weak = data.technologies.filter((t) => t.score < MAIN_VIEW_MIN_SCORE);
  const categories = CATEGORY_ORDER.filter((c) => main.some((t) => t.category === c));
  const stats: [string, number][] = [
    ["Technologies", main.length],
    ["Corroborated", main.filter((t) => t.agentCount >= CORROBORATED_MIN_AGENTS).length],
    ["Findings", data.findings],
    ["Sources", data.sources],
  ];
  return (
    <Document title={`${data.company.name} tech stack`} author="StackDowser">
      <Page size="A4" style={s.page}>
        <View style={s.band} fixed>
          <View style={s.brand}>
            <BrandMark />
            <Text style={s.brandText}>StackDowser</Text>
          </View>
          <Text style={s.bandRight}>
            Tech stack report · {data.company.name}
            {"\n"}Generated {data.generatedAt}
          </Text>
        </View>

        <View style={s.body}>
          <View style={s.company}>
            <Text style={s.h1}>{data.company.name}</Text>
            <Text style={s.sub}>
              {[data.company.domain, data.company.description].filter(Boolean).join(" · ")}
            </Text>
          </View>

          <View style={s.stats}>
            {stats.map(([label, value], i) => (
              <View key={label} style={[s.stat, i === stats.length - 1 ? { marginRight: 0 } : {}]}>
                <Text style={s.statLabel}>{label}</Text>
                <Text style={s.statValue}>{value}</Text>
              </View>
            ))}
          </View>

          {data.company.summary ? (
            <View style={s.summary}>
              <Text style={s.summaryLabel}>Architecture summary</Text>
              <Text style={s.summaryText}>{data.company.summary}</Text>
            </View>
          ) : null}

          {categories.map((c) => {
            const meta = categoryMeta(c);
            const rows = main.filter((t) => t.category === c);
            return (
              <View key={c}>
                {/* The heading travels with its first row, so it never ends a page alone. */}
                <View wrap={false}>
                  <View style={s.catHead}>
                    <View style={[s.catDot, { backgroundColor: meta.color }]} />
                    <Text style={[s.catLabel, { color: meta.color }]}>{meta.label}</Text>
                    <Text style={s.catCount}>
                      {rows.length} {rows.length === 1 ? "technology" : "technologies"}
                    </Text>
                  </View>
                  {rows[0] ? <TechRow t={rows[0]} /> : null}
                </View>
                {rows.slice(1).map((t) => (
                  <TechRow key={t.slug} t={t} />
                ))}
              </View>
            );
          })}

          {weak.length ? (
            <View style={s.weak} wrap={false}>
              <Text style={s.summaryLabel}>
                Weak signals (score below {Math.round(MAIN_VIEW_MIN_SCORE * 100)})
              </Text>
              <Text style={{ color: MUTED, lineHeight: 1.4 }}>
                {weak.map((t) => `${t.name} (${Math.round(t.score * 100)})`).join(" · ")}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={s.footer} fixed>
          <Text>Read from public sources. Treat findings as leads to confirm.</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export function renderReport(data: ReportData): Promise<Buffer> {
  return renderToBuffer(<Report data={data} />);
}
