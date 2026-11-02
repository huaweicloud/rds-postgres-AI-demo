import { IpRanges } from "./agents/footprint/ipranges.js";
import { Embeddings } from "./clients/embeddings.js";
import { Llm } from "./clients/llm.js";
import { createSearch, type Search } from "./clients/search.js";
import type { Config } from "./config.js";
import type { Db } from "./db.js";
import { Fetcher } from "./fetch/fetcher.js";
import type { Logger } from "./log.js";

// Everything an agent may call out to. Agents get it through their context, so tests can
// swap any piece for a recorded fixture.
export interface Services {
  db: Db;
  fetcher: Fetcher;
  search: Search;
  llm: Llm;
  embeddings: Embeddings;
  ipRanges: IpRanges;
  userAgent: string;
}

export function createServices(config: Config, db: Db, log: Logger): Services {
  return {
    db,
    fetcher: new Fetcher(db, config.FETCH_USER_AGENT),
    search: createSearch(db, {
      providers: config.SEARCH_PROVIDERS,
      searxngUrl: config.SEARXNG_URL,
      tavilyKey: config.TAVILY_API_KEY,
    }),
    llm: new Llm({
      baseUrl: config.LLM_BASE_URL,
      apiKey: config.LLM_API_KEY,
      model: config.LLM_MODEL,
    }),
    embeddings: new Embeddings(config.EMBEDDINGS_URL, config.EMBEDDINGS_MODEL),
    ipRanges: new IpRanges(log.child({ component: "ipranges" })),
    userAgent: config.FETCH_USER_AGENT,
  };
}
