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
