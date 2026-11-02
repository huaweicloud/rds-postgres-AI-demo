# Deploying on Huawei Cloud with RDS Supabase

This is how the reference deployment runs: an RDS for PostgreSQL Supabase application for
the database, and one ECS for everything else.

## 1. The Supabase application

Create a Supabase application on RDS for PostgreSQL. To set it up from outside the VPC you
need a DNAT gateway with an EIP for the application's API gateway, and an EIP on the
database instance. Restrict both security groups to the address you set up from.

Two settings need changing before the migrations run:

- **pg_cron.** It is listed as available but has to be preloaded. In the RDS console, add
  `pg_cron` to `shared_preload_libraries`, set `cron.database_name` to the database the
  application uses, and restart the instance. Until then `0009_cron.sql` fails and stuck
  runs are not recovered automatically (`select recover_runs();` does it by hand).
  Also set `cron.use_background_workers` to `on`: by default pg_cron opens a TCP
  connection to `localhost`, which needs a password it doesn't have, and every job run fails
  with "connection failed" (check `cron.job_run_details`).
- **The database user** the application gives you is not a superuser. The migrations only
  need ordinary privileges; nothing in them requires superuser. Tables it creates are not
  granted to `service_role` automatically, which is why `0013` grants them.

## 2. Migrations through the Supabase MCP server

Huawei's guide ([Using Supabase MCP](https://support.huaweicloud.com/intl/en-us/usermanual-rds-pg/rds_supabase_18.html))
uses [selfhosted-supabase-mcp](https://github.com/HenkDz/selfhosted-supabase-mcp), run
with Bun. Two corrections to the config template in that guide: the `args` array is
missing its closing `]`, and the server is registered as `selfhosted-supabase`, so look it
up under that name in your MCP client, not as `supabase`. URL-encode special characters in the database
password inside `--db-url`; the database name must be `supabase_db`.

The database EIP isn't needed if you run the MCP server on the ECS, which reaches the
database privately, and start it over SSH: register `ssh <ecs> <path>/run.sh` as the
server's command, where `run.sh` loads the keys from a local file and runs `bun run
dist/index.js`.

Then, in order:

1. Confirm `vector` and `pg_cron` appear in `list_available_extensions`.
2. `apply_migration` records each migration in `supabase_migrations.schema_migrations`,
   which doesn't exist on a fresh application. Create it once with `execute_sql`:
   `create schema supabase_migrations; create table supabase_migrations.schema_migrations
(version text primary key, statements text[], name text, inserted_at timestamptz not null
default now());`
3. Apply each file in `supabase/migrations/` with `apply_migration`, in numeric order.
4. Verify: `get_advisors` (no warnings on `public` tables; the ones on `auth` and `storage`
   belong to the platform), `get_rls_status` (RLS on for every table),
   `list_realtime_publications`, `list_vector_indexes`, and `select * from cron.job`
   (`list_cron_jobs` fails on this platform's bigint job ids).
5. Generate types with `generate_typescript_types`. It needs the Supabase CLI next to the
   MCP server and writes only inside the server's own directory; copy the file to
   `packages/db/src/database.types.ts` and drop the platform's own objects from it.
6. Create the demo users with `create_auth_user`, or with the Auth admin API if you'd rather
   not pass passwords through the MCP. Keep their credentials out of the repo.

## 3. The application ECS

A 4 vCPU / 8 GB instance is enough; the embedding model alone needs about 2.5 GB of RAM.
Install Docker from Docker's apt repository, copy the repository to the instance and fill
in `.env`:

- `SUPABASE_URL`: the API gateway's **private** address if the ECS is in the same VPC.
  Browsers never use it; they go through the proxy on the ECS.
- `PUBLIC_SITE_URL`: the ECS's public address, used for links in PDF reports.

```sh
docker compose up -d --build
docker compose exec worker npm run embed:technologies
```

The ECS needs outbound internet (an EIP or a NAT gateway) for search, page fetches and the
LLM. Its security group only needs 80 (and 443 if you add TLS) inbound.

Once the ECS reaches the database privately, unbind the database EIP and the gateway's
DNAT rule: nothing else needs them.

## Operating notes

- **Storage.** During the test phase, uploads failed with `403 VirtualHostDomainRequired`
  (the Storage service addressed its OBS bucket path-style). This was fixed on the platform
  on 2026-10-27. If an upload fails anyway, the PDF export still works: it sends the report
  straight to the browser instead of a link.
- **Schema cache.** If the API answers "Could not find the table … in the schema cache"
  after a migration, run `notify pgrst, 'reload schema';`.
- **The `extensions` schema.** It is owned by the platform and only `service_role` may use
  it. `grant usage on schema extensions to anon, authenticated` reports success and changes
  nothing, so a function that uses pgvector operators fails for signed-in users with
  "operator does not exist: extensions.vector <=> extensions.vector". `0015` makes
  `similar_companies` `security definer` with a fixed `search_path`.

- **Search engines throttle single IPs.** Google and Bing may rate-limit or CAPTCHA a
  server under use; on the reference ECS only Brave answered. Searches are cached for
  24 hours, and Tavily's free tier is the fallback (`TAVILY_API_KEY`).
- **Certificate transparency services are slow for big domains.** crt.sh often times out
  and Cert Spotter is the fallback; results are cached for 24 hours. Pre-run demo
  companies so the cache is warm.
- **Startup check.** The worker calls SearXNG with `format=json` at startup and exits if
  it gets HTML or a 403, which means JSON output isn't enabled in `searxng/settings.yml`.
- **Replay.** Any finished run can be replayed from its page: its evidence is re-inserted
  with the original timing and Realtime streams it as if it were live. Use it if the
  network fails during a demo.
