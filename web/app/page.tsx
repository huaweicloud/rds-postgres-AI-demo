import { AGENT_LABELS, type Agent } from "@stackdowser/db";
import { AgentIcon } from "@/components/AgentIcon";
import { RecentRuns } from "@/components/RecentRuns";
import { SearchForm } from "@/components/SearchForm";

const AGENTS: { agent: Agent; text: string }[] = [
  {
    agent: "footprint",
    text: "DNS records, certificate transparency logs and published cloud IP ranges: where each host runs, the CDN and WAF in front, the email provider.",
  },
  {
    agent: "jobs",
    text: "Public Greenhouse, Lever and Ashby boards and the careers page: the languages, databases and infrastructure the company hires for.",
  },
  {
    agent: "blog",
    text: "The engineering blog's feed or sitemap: what runs in production, what's being migrated, and what was left behind.",
  },
];

export default function Home() {
  return (
    <div className="home">
      <section className="hero">
        <span className="eyebrow">Tech stack research for Solution Architects</span>
        <h1>
          What is a company <em>built on</em>?
        </h1>
        <SearchForm />
      </section>

      <section className="how">
        {AGENTS.map(({ agent, text }) => (
          <article key={agent} className={`how-card ${agent}`}>
            <span className="how-icon">
              <AgentIcon agent={agent} size={20} />
            </span>
            <h3>{AGENT_LABELS[agent]}</h3>
            <p className="muted small">{text}</p>
          </article>
        ))}
      </section>

      <RecentRuns />
    </div>
  );
}
