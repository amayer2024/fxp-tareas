-- P0-7: the task-files bucket.
--
-- Storage policies mirror the `attachments` table rule, so a Dirección file is
-- not reachable by guessing its path. Getting this wrong is the classic way a
-- private area leaks: the database row is hidden but the object is not.

insert into storage.buckets (id, name, public, file_size_limit)
values ('task-files', 'task-files', false, 26214400)
on conflict (id) do update
set public = false,
    file_size_limit = 26214400;

-- Paths are `{task_id}/{uuid}-{filename}`. Parse the task id defensively: a
-- malformed first segment must deny, not raise, or an upload with a junk path
-- would surface as a 500 instead of a 403.
create or replace function public.storage_task_id(object_name text)
returns uuid
language sql
immutable
set search_path = public, storage
as $$
  select case
    when (storage.foldername(object_name))[1] ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then ((storage.foldername(object_name))[1])::uuid
    else null
  end;
$$;

revoke all on function public.storage_task_id(text) from public;
grant execute on function public.storage_task_id(text) to authenticated;

create policy "task files select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'task-files'
    and public.can_read_task(public.storage_task_id(name))
  );

create policy "task files insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'task-files'
    and public.can_write_task(public.storage_task_id(name))
  );

create policy "task files delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'task-files'
    and public.can_write_task(public.storage_task_id(name))
  );
