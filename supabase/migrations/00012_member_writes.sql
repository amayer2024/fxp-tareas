-- Write follows read. After 00008, seeing a space is membership-only, but
-- UPDATE still required assignee / creator / admin on non-private spaces.
-- PostgREST treats a zero-row UPDATE as success, so Guardar cambios toasted
-- and sent people back while the notes never landed.

create or replace function public.can_write_task(t uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.tasks tk
    where tk.id = t
      and public.is_space_member(tk.space_id)
  );
$$;

create or replace function public.can_write_recurrence(r uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.task_recurrences tr
    where tr.id = r
      and public.is_space_member(tr.space_id)
  );
$$;

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update to authenticated
  using (public.is_space_member(space_id))
  with check (public.is_space_member(space_id));

drop policy if exists task_recurrences_update on public.task_recurrences;
create policy task_recurrences_update on public.task_recurrences
  for update to authenticated
  using (public.is_space_member(space_id))
  with check (public.is_space_member(space_id));
