-- Teams are membership-based. Dirección stays private (invisible to
-- non-members, including admins). Operaciones and Alianzas are not private,
-- but only members can see the space or its tasks — Helen does not see
-- Operaciones, Alex does not see Alianzas.
--
-- Assignment notifications: a row is written when someone else is added as
-- an assignee. You are never notified about assigning yourself.

-- 1. Notifications -----------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  task_id uuid not null references public.tasks on delete cascade,
  actor_id uuid references public.profiles on delete set null,
  kind text not null default 'assigned',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

create index notifications_user_task_idx
  on public.notifications (user_id, task_id);

alter table public.notifications enable row level security;

create policy notifications_select on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

create policy notifications_update on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy notifications_delete on public.notifications
  for delete to authenticated
  using (user_id = auth.uid());

-- Inserts come from the trigger below (table owner / definer), not from clients.
grant select, update, delete on public.notifications to authenticated;

create or replace function public.notify_task_assigned()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- Seed and table-owner writes have no JWT. Skip rather than notify everyone.
  if auth.uid() is null then
    return new;
  end if;
  if new.user_id = auth.uid() then
    return new;
  end if;

  insert into public.notifications (user_id, task_id, actor_id, kind)
  values (new.user_id, new.task_id, auth.uid(), 'assigned');

  return new;
end;
$$;

create trigger task_assignees_notify
  after insert on public.task_assignees
  for each row execute function public.notify_task_assigned();

-- 2. Membership is the only path into every space ----------------------------

create or replace function public.can_read_task(t uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.tasks tk
    where tk.id = t
      and public.is_space_member(tk.space_id)
  );
$$;

create or replace function public.can_read_recurrence(r uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.task_recurrences tr
    where tr.id = r
      and public.is_space_member(tr.space_id)
  );
$$;

drop policy if exists spaces_select on public.spaces;
create policy spaces_select on public.spaces
  for select to authenticated
  using (public.is_space_member(id));

drop policy if exists space_members_select on public.space_members;
create policy space_members_select on public.space_members
  for select to authenticated
  using (public.is_space_member(space_id));

drop policy if exists tasks_read on public.tasks;
create policy tasks_read on public.tasks
  for select to authenticated
  using (public.is_space_member(space_id));

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.is_space_member(space_id)
  );

drop policy if exists task_recurrences_select on public.task_recurrences;
create policy task_recurrences_select on public.task_recurrences
  for select to authenticated
  using (public.is_space_member(space_id));

drop policy if exists task_recurrences_insert on public.task_recurrences;
create policy task_recurrences_insert on public.task_recurrences
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.is_space_member(space_id)
  );

-- Assignees and recurrence assignees must be members of that space, private
-- or not. Otherwise Alex could be dropped onto an Alianzas task.
create or replace function public.enforce_private_space_assignee()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  s uuid;
begin
  select space_id into s from public.tasks where id = new.task_id;
  if s is null then
    return new;
  end if;

  if not exists (
    select 1 from public.space_members
    where space_id = s and user_id = new.user_id
  ) then
    raise exception 'a task can only be assigned to members of its space'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_private_space_recurrence_assignee()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  s uuid;
begin
  select space_id into s from public.task_recurrences where id = new.recurrence_id;
  if s is null then
    return new;
  end if;

  if not exists (
    select 1 from public.space_members
    where space_id = s and user_id = new.user_id
  ) then
    raise exception 'a recurrence can only be assigned to members of its space'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- 3. Replace General with Operaciones; add Alianzas --------------------------

update public.spaces
set slug = 'operaciones',
    name = 'Operaciones',
    is_private = false,
    sort_order = 1
where id = 'b0000000-0000-0000-0000-000000000001';

insert into public.spaces (id, slug, name, is_private, sort_order)
values (
  'b0000000-0000-0000-0000-000000000002',
  'alianzas',
  'Alianzas',
  false,
  2
)
on conflict (id) do update
set slug = excluded.slug,
    name = excluded.name,
    is_private = false,
    sort_order = excluded.sort_order;
