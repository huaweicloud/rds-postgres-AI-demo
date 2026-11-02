import logos from "@iconify-json/logos/icons.json" with { type: "json" };
import * as icons from "simple-icons";
import { titleToSlug } from "simple-icons/sdk";

// A one-colour Simple Icons path on a 24×24 box, or a full-colour SVG body from Iconify's
// CC0 "logos" set, which still carries the brands Simple Icons had to drop.
export type TechIcon =
  | { kind: "path"; title: string; hex: string; path: string }
  | { kind: "svg"; title: string; body: string; width: number; height: number };

const bySlug = new Map<string, TechIcon>();
for (const icon of Object.values(icons) as unknown[]) {
  if (icon && typeof icon === "object" && "slug" in icon && "path" in icon) {
    const i = icon as { slug: string; title: string; hex: string; path: string };
    bySlug.set(i.slug, { kind: "path", title: i.title, hex: i.hex, path: i.path });
  }
}

const logoSet = logos as {
  width?: number;
  height?: number;
  icons: Record<string, { body: string; width?: number; height?: number }>;
};

function logo(name: string): TechIcon | null {
  const i = logoSet.icons[name];
  if (!i) return null;
  const width = i.width ?? logoSet.width ?? 256;
  const height = i.height ?? logoSet.height ?? 256;
  return { kind: "svg", title: name, body: i.body, width, height };
}

// Our dictionary slug → Simple Icons slug, where the name alone doesn't lead there. Some
// brands (AWS, Microsoft, Oracle, Slack among them) asked Simple Icons to remove their logos;
// those fall back to a monogram.
const ALIASES: Record<string, string> = {
  nodejs: "nodedotjs",
  nextjs: "nextdotjs",
  vue: "vuedotjs",
  nuxt: "nuxt",
  ember: "emberdotjs",
  express: "express",
  rails: "rubyonrails",
  dotnet: "dotnet",
  "apache-httpd": "apache",
  "react-native": "react",
  tailwind: "tailwindcss",
  gcp: "googlecloud",
  "google-app-engine": "googlecloud",
  "google-cloud-run": "googlecloud",
  bigquery: "googlebigquery",
  bigtable: "googlecloud",
  firestore: "firebase",
  pubsub: "googlepubsub",
  "vertex-ai": "googlecloud",
  "huawei-cloud": "huawei",
  "alibaba-cloud": "alibabacloud",
  "fly-io": "flydotio",
  linode: "akamai",
  cassandra: "apachecassandra",
  spark: "apachespark",
  hadoop: "apachehadoop",
  flink: "apacheflink",
  airflow: "apacheairflow",
  druid: "apachedruid",
  kafka: "apachekafka",
  pulsar: "apachepulsar",
  "delta-lake": "delta",
  cpp: "cplusplus",
  "objective-c": "apple",
  shell: "gnubash",
  "github-actions": "githubactions",
  argocd: "argo",
  "new-relic": "newrelic",
  "scikit-learn": "scikitlearn",
  huggingface: "huggingface",
  "google-workspace": "google",
  "google-analytics": "googleanalytics",
  "google-tag-manager": "googletagmanager",
  "facebook-pixel": "meta",
  cockroachdb: "cockroachlabs",
  nats: "natsdotio",
  ovhcloud: "ovh",
  sonarqube: "sonarqubeserver",
  artifactory: "jfrog",
  java: "openjdk",
  envoy: "envoyproxy",
  phoenix: "phoenixframework",
  "kotlin-multiplatform": "kotlin",
  swiftui: "swift",
  gemini: "googlegemini",
  "cloud-storage-fuse": "googlecloudstorage",
  "open-container-initiative": "opencontainersinitiative",
  "openid-connect": "openid",
  "arrow-flight": "apachearrow",
  cpython: "python",
  asyncio: "python",
  "zoom-rooms": "zoom",
  vault: "vault",
  statuspage: "statuspage",
  "google-cloud-cli": "googlecloud",
  "cloud-sql": "googlecloud",
  "identity-aware-proxy": "googlecloud",
  "react-testing-library": "testinglibrary",
  "apache-kafka-connect": "apachekafka",
  "kafka-kit": "apachekafka",
  librdkafka: "apachekafka",
  "confluent-schema-registry": "apachekafka",
  "sentence-transformers": "huggingface",
  paddleocr: "paddlepaddle",
  vmagent: "victoriametrics",
  gitaly: "gitlab",
  praefect: "gitlab",
};

// Our dictionary slug → an Iconify "logos" name, tried when Simple Icons has nothing. The
// square "-icon" marks read better at 20 px than wordmarks; wide wordmarks (Oracle, gRPC)
// are left out and get a monogram.
const LOGOS: Record<string, string> = {
  aws: "aws",
  "amazon-ses": "aws-ses",
  "aws-api-gateway": "aws-api-gateway",
  "aws-cloudfront": "aws-cloudfront",
  "aws-ec2": "aws-ec2",
  "aws-elb": "aws-elb",
  "aws-lambda": "aws-lambda",
  "aws-s3": "aws-s3",
  dynamodb: "aws-dynamodb",
  kinesis: "aws-kinesis",
  redshift: "aws-redshift",
  sns: "aws-sns",
  sqs: "aws-sqs",
  azure: "azure-icon",
  "microsoft-365": "microsoft-icon",
  sqlserver: "microsoft-icon",
  slack: "slack-icon",
  salesforce: "salesforce",
  twilio: "twilio-icon",
  tableau: "tableau-icon",
  segment: "segment-icon",
  sendgrid: "sendgrid-icon",
  amplitude: "amplitude-icon",
  heroku: "heroku-icon",
  dbt: "dbt-icon",
  launchdarkly: "launchdarkly-icon",
  memcached: "memcached",
  "openai-api": "openai-icon",
  gpt: "openai-icon",
  optimizely: "optimizely-icon",
  sourcegraph: "sourcegraph",
};

// Last resort: a product without its own logo takes its maker's.
const FAMILIES: [RegExp, () => TechIcon | null][] = [
  [/^(aws|amazon)\b/i, () => logo("aws")],
  [/^(azure|microsoft azure)\b/i, () => logo("azure-icon")],
  [/^microsoft\b/i, () => logo("microsoft-icon")],
  [/^stripe\b/i, () => bySlug.get("stripe") ?? null],
  [/^(java|jvm)\b/i, () => bySlug.get("openjdk") ?? null],
  [/^google\b/i, () => bySlug.get("googlecloud") ?? null],
  [/^apache\b/i, () => logo("apache-software-foundation-icon")],
];

const cache = new Map<string, TechIcon | null>();

export function findTechIcon(slug: string, name: string): TechIcon | null {
  const key = `${slug}|${name}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let found: TechIcon | null;
  if (slug in ALIASES) {
    found = ALIASES[slug] ? (bySlug.get(ALIASES[slug]!) ?? null) : null;
  } else if (slug in LOGOS) {
    found = logo(LOGOS[slug]!);
  } else {
    const candidates = [
      slug,
      titleToSlug(name),
      slug.replace(/-/g, ""),
      titleToSlug(name.replace(/^(Apache|Amazon|Google|Microsoft) /, "")),
    ];
    found = candidates.map((c) => bySlug.get(c)).find(Boolean) ?? null;
  }
  found ??= FAMILIES.find(([re]) => re.test(name) || re.test(slug))?.[1]() ?? null;
  cache.set(key, found);
  return found;
}
