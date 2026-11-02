import type { Category } from "@stackdowser/db";

export interface Tech {
  name: string;
  category: Category;
}

const t = (name: string, category: Category): Tech => ({ name, category });

// Names match aliases in the technologies seed, so the merger finds them without the LLM.
export const TECH = {
  aws: t("Amazon Web Services", "cloud"),
  cloudfront: t("Amazon CloudFront", "cloud"),
  s3: t("Amazon S3", "cloud"),
  elb: t("AWS Elastic Load Balancing", "cloud"),
  apiGateway: t("Amazon API Gateway", "cloud"),
  ses: t("Amazon SES", "saas"),
  gcp: t("Google Cloud", "cloud"),
  appEngine: t("Google App Engine", "cloud"),
  cloudRun: t("Google Cloud Run", "cloud"),
  firebase: t("Firebase", "cloud"),
  azure: t("Microsoft Azure", "cloud"),
  azureAppService: t("Azure App Service", "cloud"),
  azureFrontDoor: t("Azure Front Door", "cloud"),
  oracleCloud: t("Oracle Cloud", "cloud"),
  digitalocean: t("DigitalOcean", "cloud"),
  heroku: t("Heroku", "cloud"),
  vercel: t("Vercel", "cloud"),
  netlify: t("Netlify", "cloud"),
  fly: t("Fly.io", "cloud"),
  huawei: t("Huawei Cloud", "cloud"),
  alibaba: t("Alibaba Cloud", "cloud"),
  cloudflare: t("Cloudflare", "infra"),
  akamai: t("Akamai", "infra"),
  fastly: t("Fastly", "infra"),
  imperva: t("Imperva", "infra"),
  githubPages: t("GitHub", "devops"),
  googleWorkspace: t("Google Workspace", "saas"),
  m365: t("Microsoft 365", "saas"),
  proofpoint: t("Proofpoint", "saas"),
  mimecast: t("Mimecast", "saas"),
  sendgrid: t("SendGrid", "saas"),
  mailgun: t("Mailgun", "saas"),
  mailchimp: t("Mailchimp", "saas"),
  salesforce: t("Salesforce", "saas"),
  hubspot: t("HubSpot", "saas"),
  zendesk: t("Zendesk", "saas"),
  atlassian: t("Atlassian", "saas"),
  docusign: t("DocuSign", "saas"),
  okta: t("Okta", "saas"),
  stripe: t("Stripe", "saas"),
  metaPixel: t("Meta Pixel", "saas"),
  statuspage: t("Atlassian Statuspage", "saas"),
  shopify: t("Shopify", "saas"),
  greenhouse: t("Greenhouse", "saas"),
  lever: t("Lever", "saas"),
  workday: t("Workday", "saas"),
  intercom: t("Intercom", "saas"),
  slack: t("Slack", "saas"),
  wordpress: t("WordPress", "frontend"),
} as const;

export interface SuffixRule {
  suffix: string;
  tech: Tech;
}

// CNAME targets. Longest suffix wins, so put specific services before the parent cloud.
export const CNAME_SUFFIXES: SuffixRule[] = [
  { suffix: ".cloudfront.net", tech: TECH.cloudfront },
  { suffix: ".s3.amazonaws.com", tech: TECH.s3 },
  { suffix: ".s3-website.amazonaws.com", tech: TECH.s3 },
  { suffix: ".elb.amazonaws.com", tech: TECH.elb },
  { suffix: ".execute-api.amazonaws.com", tech: TECH.apiGateway },
  { suffix: ".awsglobalaccelerator.com", tech: TECH.aws },
  { suffix: ".amazonaws.com", tech: TECH.aws },
  { suffix: ".azurewebsites.net", tech: TECH.azureAppService },
  { suffix: ".azurefd.net", tech: TECH.azureFrontDoor },
  { suffix: ".azureedge.net", tech: TECH.azure },
  { suffix: ".cloudapp.azure.com", tech: TECH.azure },
  { suffix: ".cloudapp.net", tech: TECH.azure },
  { suffix: ".trafficmanager.net", tech: TECH.azure },
  { suffix: ".blob.core.windows.net", tech: TECH.azure },
  { suffix: ".azurestaticapps.net", tech: TECH.azure },
  { suffix: ".appspot.com", tech: TECH.appEngine },
  { suffix: ".run.app", tech: TECH.cloudRun },
  { suffix: ".googlehosted.com", tech: TECH.gcp },
  { suffix: ".ghs.googlehosted.com", tech: TECH.googleWorkspace },
  { suffix: ".web.app", tech: TECH.firebase },
  { suffix: ".firebaseapp.com", tech: TECH.firebase },
  { suffix: ".cdn.cloudflare.net", tech: TECH.cloudflare },
  { suffix: ".pages.dev", tech: TECH.cloudflare },
  { suffix: ".workers.dev", tech: TECH.cloudflare },
  { suffix: ".edgekey.net", tech: TECH.akamai },
  { suffix: ".edgesuite.net", tech: TECH.akamai },
  { suffix: ".akamaiedge.net", tech: TECH.akamai },
  { suffix: ".akamaized.net", tech: TECH.akamai },
  { suffix: ".fastly.net", tech: TECH.fastly },
  { suffix: ".fastlylb.net", tech: TECH.fastly },
  { suffix: ".incapdns.net", tech: TECH.imperva },
  { suffix: ".impervadns.net", tech: TECH.imperva },
  { suffix: ".github.io", tech: TECH.githubPages },
  { suffix: ".herokuapp.com", tech: TECH.heroku },
  { suffix: ".herokudns.com", tech: TECH.heroku },
  { suffix: ".vercel-dns.com", tech: TECH.vercel },
  { suffix: ".vercel.app", tech: TECH.vercel },
  { suffix: ".netlify.app", tech: TECH.netlify },
  { suffix: ".netlify.com", tech: TECH.netlify },
  { suffix: ".fly.dev", tech: TECH.fly },
  { suffix: ".ondigitalocean.app", tech: TECH.digitalocean },
  { suffix: ".oraclecloud.com", tech: TECH.oracleCloud },
  { suffix: ".huaweicloud.com", tech: TECH.huawei },
  { suffix: ".myhuaweicloud.com", tech: TECH.huawei },
  { suffix: ".aliyuncs.com", tech: TECH.alibaba },
  { suffix: ".kunlun.com", tech: TECH.alibaba },
  { suffix: ".myshopify.com", tech: TECH.shopify },
  { suffix: ".shops.myshopify.com", tech: TECH.shopify },
  { suffix: ".zendesk.com", tech: TECH.zendesk },
  { suffix: ".atlassian.net", tech: TECH.atlassian },
  { suffix: ".stspg-customer.com", tech: TECH.statuspage },
  { suffix: ".okta.com", tech: TECH.okta },
  { suffix: ".oktapreview.com", tech: TECH.okta },
  { suffix: ".hubspot.net", tech: TECH.hubspot },
  { suffix: ".hs-sites.com", tech: TECH.hubspot },
  { suffix: ".sendgrid.net", tech: TECH.sendgrid },
  { suffix: ".mailgun.org", tech: TECH.mailgun },
  { suffix: ".wpengine.com", tech: TECH.wordpress },
  { suffix: ".wordpress.com", tech: TECH.wordpress },
  { suffix: ".greenhouse.io", tech: TECH.greenhouse },
  { suffix: ".lever.co", tech: TECH.lever },
  { suffix: ".myworkdayjobs.com", tech: TECH.workday },
  { suffix: ".intercom.help", tech: TECH.intercom },
];

export function matchSuffix(host: string, rules: SuffixRule[] = CNAME_SUFFIXES): SuffixRule | null {
  const h = "." + host.toLowerCase().replace(/\.$/, "");
  let best: SuffixRule | null = null;
  for (const rule of rules) {
    if (h.endsWith(rule.suffix) && (!best || rule.suffix.length > best.suffix.length)) best = rule;
  }
  return best;
}

export const MX_SUFFIXES: SuffixRule[] = [
  { suffix: ".google.com", tech: TECH.googleWorkspace },
  { suffix: ".googlemail.com", tech: TECH.googleWorkspace },
  { suffix: ".mail.protection.outlook.com", tech: TECH.m365 },
  { suffix: ".pphosted.com", tech: TECH.proofpoint },
  { suffix: ".ppe-hosted.com", tech: TECH.proofpoint },
  { suffix: ".mimecast.com", tech: TECH.mimecast },
  { suffix: ".amazonaws.com", tech: TECH.ses },
  { suffix: ".mailgun.org", tech: TECH.mailgun },
  { suffix: ".sendgrid.net", tech: TECH.sendgrid },
];

export const NS_SUFFIXES: SuffixRule[] = [
  { suffix: ".cloudflare.com", tech: TECH.cloudflare },
  { suffix: ".azure-dns.com", tech: TECH.azure },
  { suffix: ".azure-dns.net", tech: TECH.azure },
  { suffix: ".azure-dns.org", tech: TECH.azure },
  { suffix: ".azure-dns.info", tech: TECH.azure },
  { suffix: ".googledomains.com", tech: TECH.gcp },
  { suffix: ".akam.net", tech: TECH.akamai },
  { suffix: ".akamaiedge.net", tech: TECH.akamai },
  { suffix: ".digitalocean.com", tech: TECH.digitalocean },
  { suffix: ".hwclouds-dns.com", tech: TECH.huawei },
  { suffix: ".hwclouds-dns.net", tech: TECH.huawei },
];

// Route 53 name servers are awsdns-NN across several TLDs, and Cloud DNS is ns-cloud-xN.
export function matchNameServer(host: string): Tech | null {
  const h = host.toLowerCase().replace(/\.$/, "");
  if (/\.awsdns-\d+\.(com|net|org|co\.uk)$/.test(h)) return TECH.aws;
  if (/^ns-cloud-[a-z]\d+\.googledomains\.com$/.test(h)) return TECH.gcp;
  return matchSuffix(h, NS_SUFFIXES)?.tech ?? null;
}

export interface PatternRule {
  pattern: RegExp;
  tech: Tech;
}

// SPF include: mechanisms name the services allowed to send mail as the domain.
export const SPF_INCLUDES: PatternRule[] = [
  { pattern: /include:_spf\.google\.com/i, tech: TECH.googleWorkspace },
  { pattern: /include:spf\.protection\.outlook\.com/i, tech: TECH.m365 },
  { pattern: /include:amazonses\.com/i, tech: TECH.ses },
  { pattern: /include:sendgrid\.net/i, tech: TECH.sendgrid },
  { pattern: /include:mailgun\.org/i, tech: TECH.mailgun },
  { pattern: /include:servers\.mcsv\.net|include:spf\.mandrillapp\.com/i, tech: TECH.mailchimp },
  { pattern: /include:_spf\.salesforce\.com|include:\S*exacttarget\.com/i, tech: TECH.salesforce },
  { pattern: /include:\S*hubspotemail\.net/i, tech: TECH.hubspot },
  { pattern: /include:mail\.zendesk\.com/i, tech: TECH.zendesk },
  { pattern: /include:\S*pphosted\.com/i, tech: TECH.proofpoint },
  { pattern: /include:\S*mimecast\.com/i, tech: TECH.mimecast },
  { pattern: /include:\S*atlassian\.net/i, tech: TECH.atlassian },
];

// Domain verification records left behind when a SaaS account was connected.
export const TXT_VERIFICATIONS: PatternRule[] = [
  { pattern: /^atlassian-domain-verification=/i, tech: TECH.atlassian },
  { pattern: /^MS=ms\d+/i, tech: TECH.m365 },
  { pattern: /^(salesforce|pardot)[-_\w]*=/i, tech: TECH.salesforce },
  {
    pattern: /^hubspot-developer-verification=|^hubspot-domain-verification=/i,
    tech: TECH.hubspot,
  },
  { pattern: /^docusign=/i, tech: TECH.docusign },
  { pattern: /^facebook-domain-verification=/i, tech: TECH.metaPixel },
  { pattern: /^stripe-verification=/i, tech: TECH.stripe },
  { pattern: /^okta-verification=/i, tech: TECH.okta },
  { pattern: /^zendeskverification=|^zendesk-verification=/i, tech: TECH.zendesk },
  { pattern: /^slack-domain-verification=/i, tech: TECH.slack },
  { pattern: /^amazonses:/i, tech: TECH.ses },
  { pattern: /^mailchimp-domain-verification=|^mandrill_verify\./i, tech: TECH.mailchimp },
];

export interface HeaderRule {
  header: string;
  pattern?: RegExp;
  tech: Tech;
}

export const HEADER_RULES: HeaderRule[] = [
  { header: "server", pattern: /^cloudflare/i, tech: TECH.cloudflare },
  { header: "cf-ray", tech: TECH.cloudflare },
  { header: "x-amz-cf-id", tech: TECH.cloudfront },
  { header: "via", pattern: /cloudfront/i, tech: TECH.cloudfront },
  { header: "server", pattern: /^AmazonS3/i, tech: TECH.s3 },
  { header: "x-amz-request-id", tech: TECH.aws },
  { header: "server", pattern: /^awselb/i, tech: TECH.elb },
  { header: "x-served-by", pattern: /cache-/i, tech: TECH.fastly },
  { header: "x-fastly-request-id", tech: TECH.fastly },
  { header: "server", pattern: /AkamaiGHost|AkamaiNetStorage/i, tech: TECH.akamai },
  { header: "x-akamai-transformed", tech: TECH.akamai },
  { header: "x-iinfo", tech: TECH.imperva },
  { header: "x-cdn", pattern: /imperva|incapsula/i, tech: TECH.imperva },
  { header: "x-azure-ref", tech: TECH.azureFrontDoor },
  { header: "x-ms-request-id", tech: TECH.azure },
  { header: "x-vercel-id", tech: TECH.vercel },
  { header: "x-nf-request-id", tech: TECH.netlify },
  { header: "fly-request-id", tech: TECH.fly },
  { header: "x-github-request-id", tech: TECH.githubPages },
  { header: "server", pattern: /^Google Frontend/i, tech: TECH.gcp },
  { header: "x-cloud-trace-context", tech: TECH.gcp },
  { header: "server", pattern: /^nginx/i, tech: t("nginx", "backend") },
  { header: "server", pattern: /^Apache/i, tech: t("Apache HTTP Server", "backend") },
  { header: "server", pattern: /^envoy/i, tech: t("Envoy", "backend") },
  { header: "x-envoy-upstream-service-time", tech: t("Envoy", "backend") },
  { header: "x-powered-by", pattern: /Next\.js/i, tech: t("Next.js", "frontend") },
  { header: "x-powered-by", pattern: /^Express/i, tech: t("Express", "backend") },
  { header: "x-powered-by", pattern: /^PHP/i, tech: t("PHP", "language") },
  { header: "x-powered-by", pattern: /ASP\.NET/i, tech: t(".NET", "backend") },
  { header: "x-aspnet-version", tech: t(".NET", "backend") },
  { header: "x-shopify-stage", tech: TECH.shopify },
  { header: "x-hw-request-id", tech: TECH.huawei },
];

// Markers in the homepage HTML. Each pattern should only match the thing it names.
export const HTML_RULES: PatternRule[] = [
  { pattern: /<script[^>]+id="__NEXT_DATA__"|\/_next\/static\//i, tech: t("Next.js", "frontend") },
  { pattern: /window\.__NUXT__|\/_nuxt\//i, tech: t("Nuxt", "frontend") },
  { pattern: /ng-version="\d/i, tech: t("Angular", "frontend") },
  {
    pattern: /data-reactroot|__REACT_DEVTOOLS_GLOBAL_HOOK__|react-dom(\.production)?(\.min)?\.js/i,
    tech: t("React", "frontend"),
  },
  { pattern: /<div[^>]+id="___gatsby"/i, tech: t("Gatsby", "frontend") },
  { pattern: /data-svelte-h=|__sveltekit/i, tech: t("Svelte", "frontend") },
  { pattern: /\/wp-content\/|\/wp-includes\//i, tech: TECH.wordpress },
  { pattern: /cdn\.shopify\.com/i, tech: TECH.shopify },
  { pattern: /googletagmanager\.com\/gtm\.js/i, tech: t("Google Tag Manager", "saas") },
  {
    pattern: /googletagmanager\.com\/gtag\/js|google-analytics\.com\/(analytics|ga)\.js/i,
    tech: t("Google Analytics", "saas"),
  },
  { pattern: /cdn\.segment\.com\/analytics\.js/i, tech: t("Segment", "saas") },
  { pattern: /static\.hotjar\.com/i, tech: t("Hotjar", "saas") },
  { pattern: /widget\.intercom\.io|js\.intercomcdn\.com/i, tech: TECH.intercom },
  { pattern: /js\.stripe\.com/i, tech: TECH.stripe },
  { pattern: /cdn\.optimizely\.com/i, tech: t("Optimizely", "saas") },
  { pattern: /cdn\.cookielaw\.org|optanon/i, tech: t("OneTrust", "saas") },
  { pattern: /connect\.facebook\.net\/[^"']*\/fbevents\.js/i, tech: TECH.metaPixel },
  { pattern: /js\.hs-scripts\.com|js\.hsforms\.net/i, tech: TECH.hubspot },
  { pattern: /cdn\.mxpnl\.com|cdn4\.mxpnl\.com/i, tech: t("Mixpanel", "saas") },
  { pattern: /cdn\.amplitude\.com/i, tech: t("Amplitude", "saas") },
  { pattern: /browser\.sentry-cdn\.com|sentry\.io\/api\//i, tech: t("Sentry", "observability") },
  {
    pattern: /datadoghq-browser-agent|www\.datadoghq-browser-agent\.com/i,
    tech: t("Datadog", "observability"),
  },
  { pattern: /js-agent\.newrelic\.com|NREUM/i, tech: t("New Relic", "observability") },
  { pattern: /cdn\.contentful\.com|images\.ctfassets\.net/i, tech: t("Contentful", "saas") },
  { pattern: /algolia(net)?\.(com|net)|algoliasearch/i, tech: t("Algolia", "saas") },
  { pattern: /launchdarkly\.com/i, tech: t("LaunchDarkly", "saas") },
];

// Subdomain names that usually mean the tool is self-hosted there. Weaker evidence than a
// record match, so the agent gives these a lower confidence.
export const SUBDOMAIN_HINTS: { label: RegExp; tech: Tech }[] = [
  { label: /^grafana\d*$/, tech: t("Grafana", "observability") },
  { label: /^(prometheus|prom)\d*$/, tech: t("Prometheus", "observability") },
  { label: /^kibana\d*$/, tech: t("Kibana", "observability") },
  { label: /^sentry\d*$/, tech: t("Sentry", "observability") },
  { label: /^jaeger\d*$/, tech: t("Jaeger", "observability") },
  { label: /^gitlab\d*$/, tech: t("GitLab", "devops") },
  { label: /^jenkins\d*$/, tech: t("Jenkins", "devops") },
  { label: /^(argocd|argo-cd|argo)$/, tech: t("Argo CD", "devops") },
  { label: /^(sonar|sonarqube)$/, tech: t("SonarQube", "devops") },
  { label: /^(artifactory|jfrog)$/, tech: t("JFrog Artifactory", "devops") },
  { label: /^bitbucket$/, tech: t("Bitbucket", "devops") },
  { label: /^(jira|confluence)$/, tech: TECH.atlassian },
  { label: /^vault$/, tech: t("HashiCorp Vault", "infra") },
  { label: /^consul$/, tech: t("Consul", "infra") },
  { label: /^nomad$/, tech: t("Nomad", "infra") },
  { label: /^(k8s|kubernetes|rancher)$/, tech: t("Kubernetes", "infra") },
  { label: /^airflow$/, tech: t("Apache Airflow", "data") },
  { label: /^(kafka|kafka-ui)$/, tech: t("Apache Kafka", "messaging") },
  { label: /^rabbitmq$/, tech: t("RabbitMQ", "messaging") },
  { label: /^(elastic|elasticsearch)$/, tech: t("Elasticsearch", "database") },
  { label: /^metabase$/, tech: t("Metabase", "data") },
  { label: /^(superset)$/, tech: t("Apache Superset", "data") },
  { label: /^tableau$/, tech: t("Tableau", "data") },
  { label: /^looker$/, tech: t("Looker", "data") },
  { label: /^mlflow$/, tech: t("MLflow", "ml") },
  { label: /^okta$/, tech: TECH.okta },
];
