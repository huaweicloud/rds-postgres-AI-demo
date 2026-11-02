-- Needs pg_cron in shared_preload_libraries (a server parameter and a restart), and
-- cron.database_name pointing at this database.
create extension if not exists pg_cron;

select cron.schedule('recover-runs', '* * * * *', 'select public.recover_runs()');
select cron.schedule('purge-caches', '17 * * * *', 'select public.purge_caches()');
