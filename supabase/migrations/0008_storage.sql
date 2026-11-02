-- Private bucket for PDF reports. The worker uploads with the service role and hands
-- out signed URLs, so no storage policies are needed for viewers.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reports', 'reports', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;
