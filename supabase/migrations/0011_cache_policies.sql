-- The caches are worker-only. The service role bypasses RLS anyway; the explicit policies
-- say so, and keep the advisor from reading "no policies" as a mistake.
create policy "worker only" on search_cache for all to service_role using (true) with check (true);
create policy "worker only" on page_cache   for all to service_role using (true) with check (true);
