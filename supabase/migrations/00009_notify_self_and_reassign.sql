-- Notify on every new assignee, including yourself. Creating a task with
-- nobody picked assigns it to you, so the bell rings for a task you made
-- for yourself. Reassignment is the same INSERT path: taking a task that
-- belonged to someone else still inserts your row and notifies you.

create or replace function public.notify_task_assigned()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- Seed and table-owner writes have no JWT. Skip rather than notify everyone.
  if auth.uid() is null then
    return new;
  end if;

  insert into public.notifications (user_id, task_id, actor_id, kind)
  values (new.user_id, new.task_id, auth.uid(), 'assigned');

  return new;
end;
$$;

create or replace function public.create_task(
  p_title text,
  p_space_id uuid,
  p_notes text default null,
  p_sede_id uuid default null,
  p_due_date date default null,
  p_priority public.task_priority default 'medium',
  p_assignee_ids uuid[] default '{}'
)
returns public.tasks
language plpgsql
security invoker
set search_path = public
as $$
declare
  t public.tasks;
  ids uuid[] := coalesce(p_assignee_ids, '{}'::uuid[]);
begin
  insert into public.tasks (
    title, notes, space_id, sede_id, due_date, priority, status, created_by
  ) values (
    trim(p_title),
    nullif(trim(coalesce(p_notes, '')), ''),
    p_space_id,
    p_sede_id,
    p_due_date,
    coalesce(p_priority, 'medium'),
    'open',
    auth.uid()
  )
  returning * into t;

  if cardinality(ids) = 0 then
    ids := array[auth.uid()];
  end if;

  insert into public.task_assignees (task_id, user_id)
  select t.id, u
  from unnest(ids) as u
  where u is not null
  on conflict do nothing;

  return t;
end;
$$;
