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
