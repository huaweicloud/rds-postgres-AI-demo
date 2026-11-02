-- StackDowser database schema: every file in supabase/migrations/, in order, in one script.
-- Run it once in the SQL editor of a new RDS Supabase application, after pg_cron is
-- preloaded (see README "1. Prepare the RDS Supabase application").
-- Generated; to rebuild after changing a migration: sh sql/build.sh

-- ===== 0001_extensions.sql =====

-- pg_cron is enabled separately in 0009 because it has to be preloaded by the server first.
-- Supabase keeps extensions in their own schema; functions that use them set search_path.
create schema if not exists extensions;
create extension if not exists vector with schema extensions;

-- ===== 0002_catalog.sql =====

-- The merged catalog: what we know about each company once a run has finished.

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text unique,
  description text,
  logo_url text,
  summary text,                      -- merger's architecture summary
  stack_embedding extensions.vector(1024),
  updated_at timestamptz default now()
);

create table technologies (
  id serial primary key,
  slug text unique not null,         -- 'postgresql'
  name text not null,                -- 'PostgreSQL'
  category text not null check (category in
    ('language','frontend','backend','database','data','messaging',
     'cloud','infra','devops','observability','ml','saas')),
  aliases text[] not null default '{}',
  name_embedding extensions.vector(1024)
);

-- Aliases are stored lowercased and version-free, the same way the merger normalizes raw names.
create index technologies_aliases_idx on technologies using gin (aliases);

create table company_stack (
  company_id uuid references companies(id) on delete cascade,
  technology_id int references technologies(id),
  run_id uuid,
  score real not null,
  status text not null check (status in ('in_use','hiring_for','migrated_away','mentioned')),
  agent_count int not null,
  evidence_count int not null,
  primary key (company_id, technology_id)
);

-- ===== 0003_runs.sql =====

-- Work in progress: a run, its agent tasks, and the evidence they write.

create table research_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id),
  requested_by uuid references auth.users(id) default auth.uid(),
  query text not null,
  domain_hint text,
  status text not null default 'resolving' check (status in
    ('resolving','researching','merging','done','failed')),
  error text,
  -- Set when a worker picks the run up for resolving; null means nobody has it yet.
  resolve_started_at timestamptz,
  -- A replay re-streams the evidence of an earlier run instead of researching.
  replay_of uuid references research_runs(id),
  created_at timestamptz default now(),
  finished_at timestamptz
);

create index research_runs_status_idx on research_runs (status, created_at);
create index research_runs_requested_by_idx on research_runs (requested_by, created_at);

create table agent_tasks (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references research_runs(id) on delete cascade,
  agent text not null check (agent in ('jobs','blog','footprint')),
  status text not null default 'queued' check (status in
    ('queued','running','done','failed','timed_out')),
  current_step text,
  searches int not null default 0,
  pages_read int not null default 0,
  llm_calls int not null default 0,
  error text,
  created_at timestamptz default now(),
  started_at timestamptz,
  heartbeat_at timestamptz,
  finished_at timestamptz
);

create index agent_tasks_queue_idx on agent_tasks (status, created_at);
create index agent_tasks_run_idx on agent_tasks (run_id);

create table evidence (
  id bigserial primary key,
  run_id uuid not null references research_runs(id) on delete cascade,
  task_id uuid references agent_tasks(id) on delete set null,
  agent text not null,
  raw_name text not null,            -- as the agent saw it
  category text,                     -- the agent's guess; the dictionary wins after the merge
  technology_id int references technologies(id),  -- set by the merger
  usage text check (usage in ('in_use','hiring_for','migrated_away','mentioned')),
  confidence real not null check (confidence between 0 and 1),
  source_url text not null,
  source_title text,
  snippet text not null,             -- the evidence rule: no snippet, no row
  published_at date,
  found_at timestamptz default now()
);

create index evidence_run_idx on evidence (run_id);

create table watchlist (
  user_id uuid references auth.users(id) default auth.uid(),
  company_id uuid references companies(id) on delete cascade,
  note text,
  created_at timestamptz default now(),
  primary key (user_id, company_id)
);

-- Fan-out: one task per agent once the company is resolved. A replay creates its own tasks,
-- already running, because it re-plays them rather than researching.
create function fan_out() returns trigger language plpgsql
  set search_path = public, extensions as $$
begin
  if new.status = 'researching' and old.status = 'resolving' and new.replay_of is null then
    insert into agent_tasks (run_id, agent)
    select new.id, a from unnest(array['jobs','blog','footprint']) a;
  end if;
  return new;
end $$;

create trigger trg_fan_out after update of status on research_runs
  for each row execute function fan_out();

-- Workers claim tasks without colliding.
create function claim_task() returns setof agent_tasks language sql
  set search_path = public, extensions as $$
  update agent_tasks
     set status = 'running', started_at = now(), heartbeat_at = now()
   where id = (select id from agent_tasks
                where status = 'queued'
                order by created_at
                for update skip locked
                limit 1)
  returning *;
$$;

-- Same pattern for the resolve step, which runs before any task exists.
create function claim_resolve() returns setof research_runs language sql
  set search_path = public, extensions as $$
  update research_runs set resolve_started_at = now()
   where id = (select id from research_runs
                where status = 'resolving' and resolve_started_at is null
                order by created_at
                for update skip locked
                limit 1)
  returning *;
$$;

-- Finishing a task and checking for the merge happen in one transaction, so two agents
-- finishing at the same moment can't both miss (or both start) the merge.
create function finish_task(p_task_id uuid, p_status text, p_error text default null)
returns boolean language plpgsql
  set search_path = public, extensions as $$
declare
  v_run uuid;
  v_moved uuid;
begin
  update agent_tasks
     set status = p_status, error = p_error, finished_at = now()
   where id = p_task_id and status = 'running'
  returning run_id into v_run;

  if v_run is null then
    return false;
  end if;

  if not exists (select 1 from agent_tasks
                  where run_id = v_run and status in ('queued','running')) then
    update research_runs set status = 'merging'
     where id = v_run and status = 'researching'
    returning id into v_moved;
  end if;

  return v_moved is not null;
end $$;

-- ===== 0004_similar_companies.sql =====

create index companies_stack_embedding_idx on companies
  using hnsw (stack_embedding extensions.vector_cosine_ops);

create function similar_companies(target uuid, k int default 5)
returns table (id uuid, name text, domain text, similarity real) language sql stable
  set search_path = public, extensions as $$
  select c.id, c.name, c.domain, (1 - (c.stack_embedding <=> t.stack_embedding))::real
    from companies c, companies t
   where t.id = target and c.id <> target and c.stack_embedding is not null
   order by c.stack_embedding <=> t.stack_embedding
   limit k;
$$;

-- The merger's fallback for names with no alias match.
create function match_technology(query_embedding extensions.vector(1024), min_similarity real default 0.9)
returns table (id int, slug text, name text, category text, similarity real)
language sql stable
  set search_path = public, extensions as $$
  select t.id, t.slug, t.name, t.category,
         (1 - (t.name_embedding <=> query_embedding))::real
    from technologies t
   where t.name_embedding is not null
     and 1 - (t.name_embedding <=> query_embedding) >= min_similarity
   order by t.name_embedding <=> query_embedding
   limit 1;
$$;

-- ===== 0005_caches_and_merge.sql =====

create table search_cache (
  query text primary key,
  provider text not null,              -- 'searxng' | 'tavily'
  results jsonb not null,
  fetched_at timestamptz not null default now()
);

create table page_cache (
  url text primary key,
  status int not null,
  content_text text,                   -- cleaned readable text
  title text,
  published_at date,
  fetched_at timestamptz not null default now()
);

alter table agent_tasks   add column retries int not null default 0;
alter table research_runs add column merge_started_at timestamptz;

-- Any worker can claim a pending merge; SKIP LOCKED makes it run exactly once.
create function claim_merge() returns setof research_runs language sql
  set search_path = public, extensions as $$
  update research_runs set merge_started_at = now()
   where id = (select id from research_runs
                where status = 'merging' and merge_started_at is null
                order by created_at
                for update skip locked
                limit 1)
  returning *;
$$;

-- Recovery for lost workers and stuck runs. pg_cron calls this every minute (0009);
-- it is a plain function so it can also be run by hand.
create function recover_runs() returns void language plpgsql
  set search_path = public, extensions as $$
begin
  -- A running task with no heartbeat for 45 s lost its worker: retry it once, then give up.
  update agent_tasks
     set status = 'queued', heartbeat_at = null, retries = retries + 1
   where status = 'running' and heartbeat_at < now() - interval '45 seconds' and retries < 1;

  update agent_tasks
     set status = 'timed_out', finished_at = now(), error = 'worker lost'
   where status = 'running' and heartbeat_at < now() - interval '45 seconds';

  -- Runs whose tasks all ended without anyone moving them on.
  update research_runs r
     set status = 'merging'
   where r.status = 'researching'
     and exists (select 1 from agent_tasks t where t.run_id = r.id)
     and not exists (select 1 from agent_tasks t
                      where t.run_id = r.id and t.status in ('queued','running'));

  -- A merge that started but never finished gets one more chance.
  update research_runs
     set merge_started_at = null
   where status = 'merging' and merge_started_at < now() - interval '3 minutes';

  update research_runs
     set resolve_started_at = null
   where status = 'resolving' and resolve_started_at < now() - interval '1 minute';

  update research_runs
     set status = 'failed', error = 'timed out', finished_at = now()
   where status in ('resolving','researching','merging')
     and created_at < now() - interval '15 minutes';
end $$;

create function purge_caches() returns void language sql
  set search_path = public, extensions as $$
  delete from search_cache where fetched_at < now() - interval '24 hours';
  delete from page_cache   where fetched_at < now() - interval '24 hours';
$$;

-- ===== 0006_rls.sql =====

-- The catalog and the work in progress are public on purpose, so Realtime can stream
-- evidence to every viewer. Only the service role (the worker) writes to them.

alter table companies      enable row level security;
alter table technologies   enable row level security;
alter table company_stack  enable row level security;
alter table research_runs  enable row level security;
alter table agent_tasks    enable row level security;
alter table evidence       enable row level security;
alter table watchlist      enable row level security;
alter table search_cache   enable row level security;
alter table page_cache     enable row level security;

create policy "read all" on companies     for select to anon, authenticated using (true);
create policy "read all" on technologies  for select to anon, authenticated using (true);
create policy "read all" on company_stack for select to anon, authenticated using (true);
create policy "read all" on agent_tasks   for select to anon, authenticated using (true);
create policy "read all" on evidence      for select to anon, authenticated using (true);
create policy "read all" on research_runs for select to anon, authenticated using (true);

create policy "insert own" on research_runs for insert to authenticated
  with check (requested_by = auth.uid());

-- The RLS showcase: two users see different rows of the same table.
create policy "own rows" on watchlist for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- The caches have no policies, so only the service role can touch them.

-- Supabase grants everything on new public tables to the browser roles by default; start
-- from nothing and grant back only what the policies above allow.
revoke all on companies, technologies, company_stack, research_runs, agent_tasks, evidence,
  watchlist, search_cache, page_cache from anon, authenticated;

grant select on companies, technologies, company_stack, research_runs, agent_tasks, evidence
  to anon, authenticated;
grant insert (query, domain_hint) on research_runs to authenticated;
grant select, insert, update, delete on watchlist to authenticated;

-- 5 runs per user per hour, checked at insert so it holds whichever client inserts.
create function enforce_run_rate_limit() returns trigger language plpgsql
  set search_path = public, extensions as $$
begin
  if new.requested_by is not null and (
       select count(*) from research_runs
        where requested_by = new.requested_by
          and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'rate limit: 5 runs per hour' using errcode = 'P0429';
  end if;
  return new;
end $$;

create trigger trg_run_rate_limit before insert on research_runs
  for each row execute function enforce_run_rate_limit();

-- Worker-only RPCs. PostgREST exposes every function in public, so take them away from
-- the browser roles explicitly.
revoke execute on function claim_task(), claim_resolve(), claim_merge(),
  finish_task(uuid, text, text), recover_runs(), purge_caches()
  from public, anon, authenticated;
grant execute on function claim_task(), claim_resolve(), claim_merge(),
  finish_task(uuid, text, text), recover_runs(), purge_caches()
  to service_role;

grant execute on function similar_companies(uuid, int) to anon, authenticated;
revoke execute on function match_technology(extensions.vector, real) from public, anon, authenticated;
grant execute on function match_technology(extensions.vector, real) to service_role;

-- ===== 0007_realtime.sql =====

alter publication supabase_realtime add table evidence, agent_tasks, research_runs;

-- ===== 0008_storage.sql =====

-- Private bucket for PDF reports. The worker uploads with the service role and hands
-- out signed URLs, so no storage policies are needed for viewers.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reports', 'reports', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

-- ===== 0009_cron.sql =====

-- Needs pg_cron in shared_preload_libraries (a server parameter and a restart), and
-- cron.database_name pointing at this database.
create extension if not exists pg_cron;

select cron.schedule('recover-runs', '* * * * *', 'select public.recover_runs()');
select cron.schedule('purge-caches', '17 * * * *', 'select public.purge_caches()');

-- ===== 0010_seed_technologies.sql =====

-- Starting dictionary. Aliases are lowercased and version-free; the merger adds new entries
-- as it meets names it can't match. Embeddings are filled in by `npm run embed:technologies`.

insert into technologies (slug, name, category, aliases) values
-- Languages
('python', 'Python', 'language', '{python,python3,py}'),
('javascript', 'JavaScript', 'language', '{javascript,js,ecmascript}'),
('typescript', 'TypeScript', 'language', '{typescript,ts}'),
('java', 'Java', 'language', '{java,jdk,openjdk}'),
('kotlin', 'Kotlin', 'language', '{kotlin}'),
('scala', 'Scala', 'language', '{scala}'),
('go', 'Go', 'language', '{go,golang}'),
('rust', 'Rust', 'language', '{rust}'),
('ruby', 'Ruby', 'language', '{ruby}'),
('php', 'PHP', 'language', '{php}'),
('csharp', 'C#', 'language', '{c#,csharp,c sharp}'),
('cpp', 'C++', 'language', '{c++,cpp}'),
('c', 'C', 'language', '{c}'),
('swift', 'Swift', 'language', '{swift}'),
('objective-c', 'Objective-C', 'language', '{objective-c,objc}'),
('elixir', 'Elixir', 'language', '{elixir}'),
('erlang', 'Erlang', 'language', '{erlang}'),
('clojure', 'Clojure', 'language', '{clojure}'),
('haskell', 'Haskell', 'language', '{haskell}'),
('dart', 'Dart', 'language', '{dart}'),
('r', 'R', 'language', '{r,rlang}'),
('sql', 'SQL', 'language', '{sql}'),
('shell', 'Shell', 'language', '{shell,bash,sh,zsh}'),
('lua', 'Lua', 'language', '{lua}'),
('perl', 'Perl', 'language', '{perl}'),
-- Frontend
('react', 'React', 'frontend', '{react,reactjs,react.js}'),
('nextjs', 'Next.js', 'frontend', '{next.js,nextjs,next}'),
('vue', 'Vue.js', 'frontend', '{vue,vuejs,vue.js}'),
('nuxt', 'Nuxt', 'frontend', '{nuxt,nuxtjs,nuxt.js}'),
('angular', 'Angular', 'frontend', '{angular,angularjs}'),
('svelte', 'Svelte', 'frontend', '{svelte,sveltekit}'),
('ember', 'Ember.js', 'frontend', '{ember,emberjs,ember.js}'),
('jquery', 'jQuery', 'frontend', '{jquery}'),
('redux', 'Redux', 'frontend', '{redux}'),
('tailwind', 'Tailwind CSS', 'frontend', '{tailwind,tailwindcss,tailwind css}'),
('webpack', 'webpack', 'frontend', '{webpack}'),
('vite', 'Vite', 'frontend', '{vite}'),
('gatsby', 'Gatsby', 'frontend', '{gatsby}'),
('remix', 'Remix', 'frontend', '{remix}'),
('react-native', 'React Native', 'frontend', '{react native,react-native}'),
('flutter', 'Flutter', 'frontend', '{flutter}'),
('graphql', 'GraphQL', 'frontend', '{graphql}'),
('wordpress', 'WordPress', 'frontend', '{wordpress,wp}'),
-- Backend
('nodejs', 'Node.js', 'backend', '{node,nodejs,node.js}'),
('express', 'Express', 'backend', '{express,expressjs,express.js}'),
('nestjs', 'NestJS', 'backend', '{nestjs,nest.js}'),
('django', 'Django', 'backend', '{django}'),
('flask', 'Flask', 'backend', '{flask}'),
('fastapi', 'FastAPI', 'backend', '{fastapi}'),
('rails', 'Ruby on Rails', 'backend', '{rails,ruby on rails,ror}'),
('spring', 'Spring', 'backend', '{spring,spring boot,springboot,spring framework}'),
('dotnet', '.NET', 'backend', '{.net,dotnet,asp.net,.net core,asp.net core}'),
('laravel', 'Laravel', 'backend', '{laravel}'),
('phoenix', 'Phoenix', 'backend', '{phoenix,phoenix framework}'),
('grpc', 'gRPC', 'backend', '{grpc}'),
('nginx', 'nginx', 'backend', '{nginx}'),
('apache-httpd', 'Apache HTTP Server', 'backend', '{apache,apache httpd,httpd}'),
('envoy', 'Envoy', 'backend', '{envoy,envoy proxy}'),
-- Databases
('postgresql', 'PostgreSQL', 'database', '{postgresql,postgres,psql,pg,aws rds postgres,rds postgres,amazon rds for postgresql,aurora postgresql}'),
('mysql', 'MySQL', 'database', '{mysql,aws rds mysql,aurora mysql}'),
('mariadb', 'MariaDB', 'database', '{mariadb}'),
('mongodb', 'MongoDB', 'database', '{mongodb,mongo,mongodb atlas}'),
('redis', 'Redis', 'database', '{redis,elasticache,amazon elasticache,valkey}'),
('cassandra', 'Apache Cassandra', 'database', '{cassandra,apache cassandra}'),
('scylladb', 'ScyllaDB', 'database', '{scylla,scylladb}'),
('dynamodb', 'Amazon DynamoDB', 'database', '{dynamodb,amazon dynamodb,dynamo}'),
('elasticsearch', 'Elasticsearch', 'database', '{elasticsearch,elastic search,es,elk}'),
('opensearch', 'OpenSearch', 'database', '{opensearch,amazon opensearch}'),
('sqlserver', 'Microsoft SQL Server', 'database', '{sql server,mssql,microsoft sql server,azure sql}'),
('oracle-db', 'Oracle Database', 'database', '{oracle,oracle database,oracle db}'),
('sqlite', 'SQLite', 'database', '{sqlite}'),
('cockroachdb', 'CockroachDB', 'database', '{cockroachdb,cockroach}'),
('neo4j', 'Neo4j', 'database', '{neo4j}'),
('memcached', 'Memcached', 'database', '{memcached,memcache}'),
('couchbase', 'Couchbase', 'database', '{couchbase}'),
('vitess', 'Vitess', 'database', '{vitess}'),
('bigtable', 'Google Bigtable', 'database', '{bigtable,cloud bigtable}'),
('firestore', 'Google Firestore', 'database', '{firestore,firebase firestore}'),
('supabase', 'Supabase', 'database', '{supabase}'),
-- Data
('snowflake', 'Snowflake', 'data', '{snowflake}'),
('bigquery', 'Google BigQuery', 'data', '{bigquery,google bigquery}'),
('redshift', 'Amazon Redshift', 'data', '{redshift,amazon redshift}'),
('databricks', 'Databricks', 'data', '{databricks}'),
('spark', 'Apache Spark', 'data', '{spark,apache spark,pyspark}'),
('hadoop', 'Apache Hadoop', 'data', '{hadoop,apache hadoop,hdfs}'),
('flink', 'Apache Flink', 'data', '{flink,apache flink}'),
('airflow', 'Apache Airflow', 'data', '{airflow,apache airflow}'),
('dbt', 'dbt', 'data', '{dbt,dbt core,dbt cloud}'),
('clickhouse', 'ClickHouse', 'data', '{clickhouse}'),
('presto', 'Presto', 'data', '{presto,prestodb}'),
('trino', 'Trino', 'data', '{trino}'),
('druid', 'Apache Druid', 'data', '{druid,apache druid}'),
('pinot', 'Apache Pinot', 'data', '{pinot,apache pinot}'),
('looker', 'Looker', 'data', '{looker}'),
('tableau', 'Tableau', 'data', '{tableau}'),
('fivetran', 'Fivetran', 'data', '{fivetran}'),
('dagster', 'Dagster', 'data', '{dagster}'),
('iceberg', 'Apache Iceberg', 'data', '{iceberg,apache iceberg}'),
('delta-lake', 'Delta Lake', 'data', '{delta lake,delta}'),
-- Messaging
('kafka', 'Apache Kafka', 'messaging', '{kafka,apache kafka,confluent,amazon msk,msk}'),
('rabbitmq', 'RabbitMQ', 'messaging', '{rabbitmq,rabbit}'),
('sqs', 'Amazon SQS', 'messaging', '{sqs,amazon sqs}'),
('sns', 'Amazon SNS', 'messaging', '{sns,amazon sns}'),
('kinesis', 'Amazon Kinesis', 'messaging', '{kinesis,amazon kinesis}'),
('pubsub', 'Google Pub/Sub', 'messaging', '{pub/sub,pubsub,google pub/sub,cloud pub/sub}'),
('nats', 'NATS', 'messaging', '{nats}'),
('pulsar', 'Apache Pulsar', 'messaging', '{pulsar,apache pulsar}'),
('celery', 'Celery', 'messaging', '{celery}'),
('sidekiq', 'Sidekiq', 'messaging', '{sidekiq}'),
('temporal', 'Temporal', 'messaging', '{temporal,temporal.io}'),
-- Cloud
('aws', 'Amazon Web Services', 'cloud', '{aws,amazon web services,amazon aws}'),
('gcp', 'Google Cloud', 'cloud', '{gcp,google cloud,google cloud platform}'),
('azure', 'Microsoft Azure', 'cloud', '{azure,microsoft azure}'),
('huawei-cloud', 'Huawei Cloud', 'cloud', '{huawei cloud,huaweicloud}'),
('alibaba-cloud', 'Alibaba Cloud', 'cloud', '{alibaba cloud,aliyun}'),
('oracle-cloud', 'Oracle Cloud', 'cloud', '{oracle cloud,oci}'),
('digitalocean', 'DigitalOcean', 'cloud', '{digitalocean,digital ocean}'),
('heroku', 'Heroku', 'cloud', '{heroku}'),
('vercel', 'Vercel', 'cloud', '{vercel}'),
('netlify', 'Netlify', 'cloud', '{netlify}'),
('fly-io', 'Fly.io', 'cloud', '{fly.io,fly}'),
('hetzner', 'Hetzner', 'cloud', '{hetzner}'),
('ovhcloud', 'OVHcloud', 'cloud', '{ovh,ovhcloud}'),
('linode', 'Akamai Cloud (Linode)', 'cloud', '{linode,akamai cloud}'),
('aws-s3', 'Amazon S3', 'cloud', '{s3,amazon s3,aws s3}'),
('aws-lambda', 'AWS Lambda', 'cloud', '{lambda,aws lambda}'),
('aws-ec2', 'Amazon EC2', 'cloud', '{ec2,amazon ec2}'),
('aws-cloudfront', 'Amazon CloudFront', 'cloud', '{cloudfront,amazon cloudfront,aws cloudfront}'),
('aws-elb', 'AWS Elastic Load Balancing', 'cloud', '{elb,alb,nlb,elastic load balancing}'),
('aws-api-gateway', 'Amazon API Gateway', 'cloud', '{api gateway,amazon api gateway}'),
('google-app-engine', 'Google App Engine', 'cloud', '{app engine,google app engine}'),
('google-cloud-run', 'Google Cloud Run', 'cloud', '{cloud run,google cloud run}'),
('azure-app-service', 'Azure App Service', 'cloud', '{azure app service,app service,azure web apps}'),
('azure-front-door', 'Azure Front Door', 'cloud', '{azure front door,front door}'),
('firebase', 'Firebase', 'cloud', '{firebase,firebase hosting}'),
-- Infra (CDN, WAF, edge, hosting plumbing)
('cloudflare', 'Cloudflare', 'infra', '{cloudflare,cloudflare cdn,cloudflare waf}'),
('akamai', 'Akamai', 'infra', '{akamai,akamai cdn}'),
('fastly', 'Fastly', 'infra', '{fastly}'),
('imperva', 'Imperva', 'infra', '{imperva,incapsula}'),
('kubernetes', 'Kubernetes', 'infra', '{kubernetes,k8s,eks,gke,aks,amazon eks}'),
('docker', 'Docker', 'infra', '{docker,docker compose}'),
('terraform', 'Terraform', 'infra', '{terraform,opentofu}'),
('pulumi', 'Pulumi', 'infra', '{pulumi}'),
('ansible', 'Ansible', 'infra', '{ansible}'),
('helm', 'Helm', 'infra', '{helm}'),
('istio', 'Istio', 'infra', '{istio}'),
('consul', 'Consul', 'infra', '{consul}'),
('vault', 'HashiCorp Vault', 'infra', '{vault,hashicorp vault}'),
('nomad', 'Nomad', 'infra', '{nomad}'),
('linux', 'Linux', 'infra', '{linux}'),
-- DevOps
('github', 'GitHub', 'devops', '{github,github enterprise}'),
('github-actions', 'GitHub Actions', 'devops', '{github actions}'),
('gitlab', 'GitLab', 'devops', '{gitlab,gitlab ci}'),
('jenkins', 'Jenkins', 'devops', '{jenkins}'),
('circleci', 'CircleCI', 'devops', '{circleci,circle ci}'),
('argocd', 'Argo CD', 'devops', '{argocd,argo cd,argo}'),
('bitbucket', 'Bitbucket', 'devops', '{bitbucket}'),
('buildkite', 'Buildkite', 'devops', '{buildkite}'),
('sonarqube', 'SonarQube', 'devops', '{sonarqube,sonar}'),
('artifactory', 'JFrog Artifactory', 'devops', '{artifactory,jfrog}'),
('bazel', 'Bazel', 'devops', '{bazel}'),
-- Observability
('datadog', 'Datadog', 'observability', '{datadog}'),
('prometheus', 'Prometheus', 'observability', '{prometheus}'),
('grafana', 'Grafana', 'observability', '{grafana}'),
('new-relic', 'New Relic', 'observability', '{new relic,newrelic}'),
('splunk', 'Splunk', 'observability', '{splunk}'),
('sentry', 'Sentry', 'observability', '{sentry}'),
('opentelemetry', 'OpenTelemetry', 'observability', '{opentelemetry,otel}'),
('honeycomb', 'Honeycomb', 'observability', '{honeycomb}'),
('kibana', 'Kibana', 'observability', '{kibana}'),
('jaeger', 'Jaeger', 'observability', '{jaeger}'),
('pagerduty', 'PagerDuty', 'observability', '{pagerduty}'),
('logstash', 'Logstash', 'observability', '{logstash}'),
-- ML
('pytorch', 'PyTorch', 'ml', '{pytorch,torch}'),
('tensorflow', 'TensorFlow', 'ml', '{tensorflow,tf}'),
('scikit-learn', 'scikit-learn', 'ml', '{scikit-learn,sklearn}'),
('pandas', 'pandas', 'ml', '{pandas}'),
('numpy', 'NumPy', 'ml', '{numpy}'),
('mlflow', 'MLflow', 'ml', '{mlflow}'),
('kubeflow', 'Kubeflow', 'ml', '{kubeflow}'),
('sagemaker', 'Amazon SageMaker', 'ml', '{sagemaker,amazon sagemaker}'),
('huggingface', 'Hugging Face', 'ml', '{hugging face,huggingface,transformers}'),
('openai-api', 'OpenAI API', 'ml', '{openai,openai api,gpt-4,chatgpt api}'),
('vertex-ai', 'Google Vertex AI', 'ml', '{vertex ai,vertex}'),
('ray', 'Ray', 'ml', '{ray}'),
-- SaaS (email, verifications, analytics, business tools)
('google-workspace', 'Google Workspace', 'saas', '{google workspace,g suite,gsuite,gmail}'),
('microsoft-365', 'Microsoft 365', 'saas', '{microsoft 365,office 365,o365,exchange online,outlook}'),
('atlassian', 'Atlassian', 'saas', '{atlassian,jira,confluence}'),
('salesforce', 'Salesforce', 'saas', '{salesforce,sfdc}'),
('hubspot', 'HubSpot', 'saas', '{hubspot}'),
('zendesk', 'Zendesk', 'saas', '{zendesk}'),
('slack', 'Slack', 'saas', '{slack}'),
('okta', 'Okta', 'saas', '{okta}'),
('auth0', 'Auth0', 'saas', '{auth0}'),
('stripe', 'Stripe', 'saas', '{stripe}'),
('twilio', 'Twilio', 'saas', '{twilio}'),
('sendgrid', 'SendGrid', 'saas', '{sendgrid}'),
('mailchimp', 'Mailchimp', 'saas', '{mailchimp,mandrill}'),
('mailgun', 'Mailgun', 'saas', '{mailgun}'),
('amazon-ses', 'Amazon SES', 'saas', '{ses,amazon ses}'),
('proofpoint', 'Proofpoint', 'saas', '{proofpoint}'),
('mimecast', 'Mimecast', 'saas', '{mimecast}'),
('docusign', 'DocuSign', 'saas', '{docusign}'),
('google-analytics', 'Google Analytics', 'saas', '{google analytics,ga4,gtag}'),
('google-tag-manager', 'Google Tag Manager', 'saas', '{google tag manager,gtm}'),
('segment', 'Segment', 'saas', '{segment,twilio segment}'),
('amplitude', 'Amplitude', 'saas', '{amplitude}'),
('mixpanel', 'Mixpanel', 'saas', '{mixpanel}'),
('hotjar', 'Hotjar', 'saas', '{hotjar}'),
('intercom', 'Intercom', 'saas', '{intercom}'),
('optimizely', 'Optimizely', 'saas', '{optimizely}'),
('launchdarkly', 'LaunchDarkly', 'saas', '{launchdarkly}'),
('greenhouse', 'Greenhouse', 'saas', '{greenhouse}'),
('lever', 'Lever', 'saas', '{lever}'),
('workday', 'Workday', 'saas', '{workday}'),
('statuspage', 'Atlassian Statuspage', 'saas', '{statuspage}'),
('shopify', 'Shopify', 'saas', '{shopify}'),
('contentful', 'Contentful', 'saas', '{contentful}'),
('algolia', 'Algolia', 'saas', '{algolia}'),
('onetrust', 'OneTrust', 'saas', '{onetrust}'),
('facebook-pixel', 'Meta Pixel', 'saas', '{facebook pixel,meta pixel}')
on conflict (slug) do nothing;

-- ===== 0011_cache_policies.sql =====

-- The caches are worker-only. The service role bypasses RLS anyway; the explicit policies
-- say so, and keep the advisor from reading "no policies" as a mistake.
create policy "worker only" on search_cache for all to service_role using (true) with check (true);
create policy "worker only" on page_cache   for all to service_role using (true) with check (true);

-- ===== 0012_fk_indexes.sql =====

-- Covering indexes for the foreign keys the earlier migrations left bare.
create index research_runs_company_idx   on research_runs (company_id);
create index research_runs_replay_of_idx on research_runs (replay_of);
create index evidence_task_idx           on evidence (task_id);
create index evidence_technology_idx     on evidence (technology_id);

-- ===== 0013_service_role_grants.sql =====

-- Hosted Supabase grants the service role everything in public by default. Some self-hosted
-- setups only do that for tables their admin role creates, so grant it explicitly. The
-- default privileges cover tables later migrations create as the same role.
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;

notify pgrst, 'reload schema';

-- ===== 0014_extensions_usage.sql =====

-- similar_companies() runs as the caller, and pgvector's operators live in the extensions
-- schema. Hosted Supabase lets the API roles use that schema; grant it where it doesn't.
grant usage on schema extensions to anon, authenticated;

-- ===== 0015_similar_companies_definer.sql =====

-- Where the extensions schema belongs to a platform admin role and the grant in 0014 can't
-- take effect, callers can't resolve pgvector's operators. similar_companies() only reads
-- public catalog data, so let it run with its owner's rights instead.
alter function similar_companies(uuid, int) security definer;
