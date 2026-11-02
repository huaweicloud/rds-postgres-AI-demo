-- similar_companies() runs as the caller, and pgvector's operators live in the extensions
-- schema. Hosted Supabase lets the API roles use that schema; grant it where it doesn't.
grant usage on schema extensions to anon, authenticated;
