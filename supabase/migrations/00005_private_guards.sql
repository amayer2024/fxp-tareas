-- P0-5: triggers that protect the private-space invariants.
--
-- RLS decides who may read and write. These triggers stop a *permitted* write
-- from quietly widening access. Policies alone are not enough: a Dirección
-- member is allowed to edit a Dirección task, and nothing in the policies stops
-- them adding an outsider as a second assignee, which would hand that outsider
-- read access to a task in a space they cannot see.

-- 1. A private space can never become public ---------------------------------

create or replace function public.guard_private_space()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.is_private and not new.is_private then
    raise exception 'a private space cannot be made public'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger spaces_guard_private
  before update of is_private on public.spaces
  for each row execute function public.guard_private_space();

-- 2. Tasks in a private space belong to members only -------------------------

create or replace function public.enforce_private_space_task()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_private_space(new.space_id) then
    return new;
  end if;

  if not exists (
    select 1 from public.space_members
    where space_id = new.space_id and user_id = new.created_by
  ) then
    raise exception 'a private space task must be created by a member of the space'
      using errcode = '42501';
  end if;

  -- Moving an existing task into a private space must not drag outsiders in
  -- with it. On INSERT there are no assignees yet, so this only applies here.
  if tg_op = 'UPDATE' and exists (
    select 1
    from public.task_assignees ta
    where ta.task_id = new.id
      and not exists (
        select 1 from public.space_members sm
        where sm.space_id = new.space_id and sm.user_id = ta.user_id
      )
  ) then
    raise exception 'cannot move a task into a private space while it is assigned to non-members'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger tasks_enforce_private_space
  before insert or update of space_id, created_by on public.tasks
  for each row execute function public.enforce_private_space_task();

-- 3. The multi-assignee leak path --------------------------------------------
-- This is the trigger that having several assignees per task makes necessary.

create or replace function public.enforce_private_space_assignee()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  s uuid;
begin
  select space_id into s from public.tasks where id = new.task_id;

  if s is null or not public.is_private_space(s) then
    return new;
  end if;

  if not exists (
    select 1 from public.space_members
    where space_id = s and user_id = new.user_id
  ) then
    raise exception 'a private space task can only be assigned to members of the space'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger task_assignees_enforce_private_space
  before insert or update on public.task_assignees
  for each row execute function public.enforce_private_space_assignee();

-- 4. Same rule for recurring templates ---------------------------------------
-- Without this, a recurrence in Dirección assigned to an outsider would spawn
-- tasks that trigger 3 then rejects, breaking generation instead of the setup.

create or replace function public.enforce_private_space_recurrence_assignee()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  s uuid;
begin
  select space_id into s from public.task_recurrences where id = new.recurrence_id;

  if s is null or not public.is_private_space(s) then
    return new;
  end if;

  if not exists (
    select 1 from public.space_members
    where space_id = s and user_id = new.user_id
  ) then
    raise exception 'a private space recurrence can only be assigned to members of the space'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger recurrence_assignees_enforce_private_space
  before insert or update on public.recurrence_assignees
  for each row execute function public.enforce_private_space_recurrence_assignee();

create or replace function public.enforce_private_space_recurrence()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_private_space(new.space_id) then
    return new;
  end if;

  if not exists (
    select 1 from public.space_members
    where space_id = new.space_id and user_id = new.created_by
  ) then
    raise exception 'a private space recurrence must be created by a member of the space'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger task_recurrences_enforce_private_space
  before insert or update of space_id, created_by on public.task_recurrences
  for each row execute function public.enforce_private_space_recurrence();
