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
