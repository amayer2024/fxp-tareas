-- Who the task was assigned to, as opposed to who receives the notice.
-- Teammates get a copy so David sees "Test se asignó una tarea" when Test
-- creates a task for himself. actor_id stays the person who made the change.

alter table public.notifications
  add column if not exists subject_id uuid references public.profiles on delete set null;

alter table public.notifications
  add column if not exists actor_name text not null default '';

update public.notifications
set subject_id = user_id
where subject_id is null
  and kind = 'assigned';

update public.notifications n
set actor_name = p.full_name
from public.profiles p
where n.actor_id = p.id
  and n.actor_name = '';

create or replace function public.notify_people(
  p_user_ids uuid[],
  p_task_id uuid,
  p_title text,
  p_kind text
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  an text;
begin
  if auth.uid() is null then
    return;
  end if;

  select full_name into an from public.profiles where id = auth.uid();

  insert into public.notifications (
    user_id, task_id, actor_id, actor_name, kind, title
  )
  select distinct u, p_task_id, auth.uid(), coalesce(an, ''), p_kind, coalesce(p_title, '')
  from unnest(p_user_ids) as u
  where u is not null;
end;
$$;

create or replace function public.notify_task_assigned()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  t text;
  s uuid;
  an text;
begin
  if auth.uid() is null then
    return new;
  end if;

  select title, space_id into t, s
  from public.tasks
  where id = new.task_id;

  select full_name into an from public.profiles where id = auth.uid();

  insert into public.notifications (
    user_id, task_id, actor_id, actor_name, subject_id, kind, title
  )
  values (
    new.user_id, new.task_id, auth.uid(), coalesce(an, ''),
    new.user_id, 'assigned', coalesce(t, '')
  );

  -- Everyone else on the team, except the assignee (already notified) and
  -- the actor (they made the change).
  insert into public.notifications (
    user_id, task_id, actor_id, actor_name, subject_id, kind, title
  )
  select sm.user_id, new.task_id, auth.uid(), coalesce(an, ''),
         new.user_id, 'assigned', coalesce(t, '')
  from public.space_members sm
  where sm.space_id = s
    and sm.user_id is distinct from new.user_id
    and sm.user_id is distinct from auth.uid();

  return new;
end;
$$;

-- Insert new people first, then drop the ones who left. Deleting first would
-- strip the caller's assignee row and RLS would silently skip the INSERT, so
-- the new owner never landed and never got a notice.
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
  insert into public.task_assignees (task_id, user_id)
  select p_task_id, u
  from unnest(ids) as u
  where u is not null
    and not exists (
      select 1 from public.task_assignees a
      where a.task_id = p_task_id and a.user_id = u
    );

  delete from public.task_assignees
  where task_id = p_task_id
    and not (user_id = any (ids));
end;
$$;
