-- JAK - flowTracker backend, part 2: file storage.
-- One private bucket. A file can be uploaded or downloaded only if its row in public.files exists
-- and the user is allowed to see it, so storage follows exactly the same rules as the database.
-- Download links are created on demand and expire, instead of long-lived public links.

insert into storage.buckets (id, name, public, file_size_limit)
values ('files', 'files', false, 52428800)  -- 50 MB per file
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create policy "jak files: read" on storage.objects for select to authenticated using (
  bucket_id = 'files'
  and exists (select 1 from public.files f where f.storage_path = storage.objects.name and public.can_see_file(f.id)));

-- Upload only to the path the database assigned, by the person who created the file row.
create policy "jak files: upload" on storage.objects for insert to authenticated with check (
  bucket_id = 'files'
  and exists (select 1 from public.files f where f.storage_path = storage.objects.name and f.uploaded_by = auth.uid()));

create policy "jak files: delete" on storage.objects for delete to authenticated using (
  bucket_id = 'files'
  and exists (select 1 from public.files f where f.storage_path = storage.objects.name
               and (f.uploaded_by = auth.uid() or public.is_manager())));
