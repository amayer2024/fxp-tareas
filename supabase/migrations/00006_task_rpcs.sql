-- P0-6: task mutations that touch more than one table.
--
-- SECURITY INVOKER throughout, so RLS and the private-space triggers still
-- apply. These functions exist for atomicity, not for privilege. Never make one
-- SECURITY DEFINER to "make it work" — that would route around the policies in
-- 00004 and the guards in 00005.

-- Create a task and its assignees in one transaction, so a task can never be
-- briefly visible with nobody on it.
-- Optional parameters carry SQL defaults, which makes them optional in the
-- generated TypeScript types too. Postgres requires defaulted parameters to come
-- last, so the signature is ordered accordingly; callers use named arguments, so
-- the order does not affect them.
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

  insert into public.task_assignees (task_id, user_id)
  select t.id, u
  from unnest(coalesce(p_assignee_ids, '{}'::uuid[])) as u
  where u is not null
  on conflict do nothing;

  return t;
end;
$$;

-- Replace the assignee set wholesale. The UI always sends the full list, which
-- avoids an add/remove protocol and the races that come with it.
create or replace function public.set_task_assignees(
  p_task_id uuid,
  p_assignee_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  ids uuid[] := coalesce(p_assignee_ids, '{}'::uuid[]);
begin
  delete from public.task_assignees
  where task_id = p_task_id
    and not (user_id = any (ids));

  insert into public.task_assignees (task_id, user_id)
  select p_task_id, u
  from unnest(ids) as u
  where u is not null
  on conflict do nothing;
end;
$$;

revoke all on function public.create_task(
  text, uuid, text, uuid, date, public.task_priority, uuid[]
) from public;
revoke all on function public.set_task_assignees(uuid, uuid[]) from public;

grant execute on function public.create_task(
  text, uuid, text, uuid, date, public.task_priority, uuid[]
) to authenticated;
grant execute on function public.set_task_assignees(uuid, uuid[]) to authenticated;
