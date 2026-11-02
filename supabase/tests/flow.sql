-- Exercises the coordination layer: fan-out, claiming, the merge hand-off, recovery,
-- the rate limit and RLS. Each check raises on failure, so psql -v ON_ERROR_STOP=1 exits non-zero.

\set user1 '''a0000000-0000-0000-0000-000000000001'''
\set user2 '''a0000000-0000-0000-0000-000000000002'''

insert into auth.users values (:user1::uuid), (:user2::uuid);
insert into companies (id, name, domain) values
  ('c0000000-0000-0000-0000-000000000001', 'Acme', 'acme.example');

-- Fan-out happens on resolving -> researching.
insert into research_runs (id, query, requested_by)
values ('b0000000-0000-0000-0000-000000000001', 'acme', :user1::uuid);

do $$ begin
  if (select count(*) from claim_resolve()) <> 1 then raise exception 'claim_resolve'; end if;
  if (select count(*) from claim_resolve()) <> 0 then raise exception 'resolve claimed twice'; end if;
end $$;

update research_runs set status = 'researching', company_id = 'c0000000-0000-0000-0000-000000000001'
 where id = 'b0000000-0000-0000-0000-000000000001';

do $$ begin
  if (select count(*) from agent_tasks where run_id = 'b0000000-0000-0000-0000-000000000001') <> 3
  then raise exception 'fan_out should create 3 tasks'; end if;
end $$;

-- Three claims get three different tasks, the fourth gets nothing.
create temp table claimed as select * from claim_task();
insert into claimed select * from claim_task();
insert into claimed select * from claim_task();
do $$ begin
  if (select count(distinct id) from claimed) <> 3 then raise exception 'claims collided'; end if;
  if (select count(*) from claim_task()) <> 0 then raise exception 'claimed a fourth task'; end if;
end $$;

-- Only the last finisher moves the run to merging.
do $$
declare
  t record;
  moved int := 0;
begin
  for t in select id from claimed order by agent loop
    if finish_task(t.id, 'done') then moved := moved + 1; end if;
  end loop;
  if moved <> 1 then raise exception 'expected exactly one merge hand-off, got %', moved; end if;
  if not finish_task((select id from claimed limit 1), 'done') is false then
    raise exception 'finishing a finished task should be a no-op';
  end if;
  if (select status from research_runs where id = 'b0000000-0000-0000-0000-000000000001') <> 'merging'
  then raise exception 'run should be merging'; end if;
  if (select count(*) from claim_merge()) <> 1 then raise exception 'claim_merge'; end if;
  if (select count(*) from claim_merge()) <> 0 then raise exception 'merge claimed twice'; end if;
end $$;

-- Recovery requeues a task whose worker vanished, then times it out on the second loss.
insert into research_runs (id, query, status, company_id)
values ('b0000000-0000-0000-0000-000000000002', 'acme', 'resolving',
        'c0000000-0000-0000-0000-000000000001');
update research_runs set status = 'researching' where id = 'b0000000-0000-0000-0000-000000000002';
update agent_tasks set status = 'done'
 where run_id = 'b0000000-0000-0000-0000-000000000002' and agent <> 'jobs';
update agent_tasks set status = 'running', heartbeat_at = now() - interval '2 minutes'
 where run_id = 'b0000000-0000-0000-0000-000000000002' and agent = 'jobs';

select recover_runs();
do $$ begin
  if (select status from agent_tasks where run_id = 'b0000000-0000-0000-0000-000000000002'
       and agent = 'jobs') <> 'queued' then raise exception 'lost task should be requeued'; end if;
end $$;

update agent_tasks set status = 'running', heartbeat_at = now() - interval '2 minutes'
 where run_id = 'b0000000-0000-0000-0000-000000000002' and agent = 'jobs';
select recover_runs();
do $$ begin
  if (select status from agent_tasks where run_id = 'b0000000-0000-0000-0000-000000000002'
       and agent = 'jobs') <> 'timed_out' then raise exception 'twice-lost task should time out'; end if;
  if (select status from research_runs where id = 'b0000000-0000-0000-0000-000000000002') <> 'merging'
  then raise exception 'recovery should move the run to merging'; end if;
end $$;

-- RLS and grants, as the browser roles see them.
insert into watchlist (user_id, company_id)
values (:user1::uuid, 'c0000000-0000-0000-0000-000000000001');

set role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', false);
do $$ begin
  if (select count(*) from watchlist) <> 0 then raise exception 'user2 sees user1 watchlist'; end if;
  if (select count(*) from evidence) <> 0 then raise exception 'evidence should be readable'; end if;
end $$;

-- A user can't start a run in someone else's name.
do $$ begin
  begin
    insert into research_runs (query, requested_by)
    values ('x', 'a0000000-0000-0000-0000-000000000001');
    raise exception 'inserted a run for another user';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Five runs an hour, the sixth is refused.
insert into research_runs (query) select 'q' || g from generate_series(1, 5) g;
do $$ begin
  begin
    insert into research_runs (query) values ('q6');
    raise exception 'sixth run in an hour was accepted';
  exception when sqlstate 'P0429' then null;
  end;
end $$;

-- Worker RPCs are not callable from the browser.
do $$ begin
  begin
    perform claim_task();
    raise exception 'authenticated can call claim_task';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', false);
set role authenticated;
do $$ begin
  if (select count(*) from watchlist) <> 1 then raise exception 'user1 should see own watchlist'; end if;
end $$;
reset role;

\echo flow.sql: all checks passed
