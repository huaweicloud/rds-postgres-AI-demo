-- Hosted Supabase grants the service role everything in public by default. Some self-hosted
-- setups only do that for tables their admin role creates, so grant it explicitly. The
-- default privileges cover tables later migrations create as the same role.
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;

notify pgrst, 'reload schema';
