-- pg_cron is enabled separately in 0009 because it has to be preloaded by the server first.
-- Supabase keeps extensions in their own schema; functions that use them set search_path.
create schema if not exists extensions;
create extension if not exists vector with schema extensions;
