-- Keep a title on every notice so a deleted task still has a label.
-- task_id becomes nullable: deleting a task must not wipe the notice.

alter table public.notifications
  add column if not exists title text not null default '';

update public.notifications n
set title = t.title
from public.tasks t
where n.task_id = t.id
  and n.title = '';

alter table public.notifications
  alter column task_id drop not null;

alter table public.notifications
  drop constraint if exists notifications_task_id_fkey;

alter table public.notifications
  add constraint notifications_task_id_fkey
  foreign key (task_id) references public.tasks (id) on delete set null;

create or replace function public.notify_people(
  p_user_ids uuid[],
  p_task_id uuid,
  p_title text,
  p_kind text
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  insert into public.notifications (user_id, task_id, actor_id, kind, title)
  select distinct u, p_task_id, auth.uid(), p_kind, coalesce(p_title, '')
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
begin
  if auth.uid() is null then
    return new;
  end if;

  select title into t from public.tasks where id = new.task_id;

  insert into public.notifications (user_id, task_id, actor_id, kind, title)
  values (new.user_id, new.task_id, auth.uid(), 'assigned', coalesce(t, ''));

  return new;
end;
$$;

-- Whole team = every member of the task's space.
create or replace function public.notify_task_done()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status is distinct from 'done' then
    return new;
  end if;
  if old.status is not distinct from 'done' then
    return new;
  end if;

  perform public.notify_people(
    array(
      select user_id from public.space_members where space_id = new.space_id
    ),
    new.id,
    new.title,
    'done'
  );

  return new;
end;
$$;

create trigger tasks_notify_done
  after update of status on public.tasks
  for each row execute function public.notify_task_done();

-- Assignees plus the creator. Snapshot the title before the row is gone.
create or replace function public.notify_task_deleted()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.notify_people(
    array(
      select old.created_by
      union
      select user_id from public.task_assignees where task_id = old.id
    ),
    old.id,
    old.title,
    'deleted'
  );

  return old;
end;
$$;

create trigger tasks_notify_deleted
  before delete on public.tasks
  for each row execute function public.notify_task_deleted();
