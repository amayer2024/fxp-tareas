-- P0-4: RLS helpers and policies on every table.
-- Access control lives here, never in a JavaScript `if`.
--
-- THE RULE: membership of a private space is the only path into it.
-- `is_admin()` appears nowhere in a private-space branch. Do not add it. An admin
-- escape hatch would hand the Dirección space to whoever is made an admin later,
-- which is the entire feature. If access is lost, fix it with a migration.

-- Helpers --------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and active
  );
$$;

create or replace function public.is_space_member(s uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.space_members
    where space_id = s and user_id = auth.uid()
  );
$$;

create or replace function public.is_private_space(s uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select coalesce((select is_private from public.spaces where id = s), false);
$$;

-- security definer is load-bearing: the policy on `tasks` calls this, and the
-- policies on `task_assignees` read `tasks`. Without definer those two recurse.
-- Bypassing RLS here is safe because it only ever answers about auth.uid().
create or replace function public.is_task_assignee(t uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.task_assignees
    where task_id = t and user_id = auth.uid()
  );
$$;

-- Child tables (assignees, comments, attachments) delegate here instead of
-- relying on RLS over a subquery, so the rule is written exactly once.
create or replace function public.can_read_task(t uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.tasks tk
    where tk.id = t
      and (
        not public.is_private_space(tk.space_id)
        or public.is_space_member(tk.space_id)
      )
  );
$$;

create or replace function public.can_write_task(t uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.tasks tk
    where tk.id = t
      and case
        when public.is_private_space(tk.space_id)
          then public.is_space_member(tk.space_id)
        else public.is_task_assignee(tk.id)
          or tk.created_by = auth.uid()
          or public.is_admin()
      end
  );
$$;

create or replace function public.can_read_recurrence(r uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.task_recurrences tr
    where tr.id = r
      and (
        not public.is_private_space(tr.space_id)
        or public.is_space_member(tr.space_id)
      )
  );
$$;

create or replace function public.can_write_recurrence(r uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.task_recurrences tr
    where tr.id = r
      and case
        when public.is_private_space(tr.space_id)
          then public.is_space_member(tr.space_id)
        else tr.created_by = auth.uid() or public.is_admin()
      end
  );
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_space_member(uuid) from public;
revoke all on function public.is_private_space(uuid) from public;
revoke all on function public.is_task_assignee(uuid) from public;
revoke all on function public.can_read_task(uuid) from public;
revoke all on function public.can_write_task(uuid) from public;
revoke all on function public.can_read_recurrence(uuid) from public;
revoke all on function public.can_write_recurrence(uuid) from public;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_space_member(uuid) to authenticated;
grant execute on function public.is_private_space(uuid) to authenticated;
grant execute on function public.is_task_assignee(uuid) to authenticated;
grant execute on function public.can_read_task(uuid) to authenticated;
grant execute on function public.can_write_task(uuid) to authenticated;
grant execute on function public.can_read_recurrence(uuid) to authenticated;
grant execute on function public.can_write_recurrence(uuid) to authenticated;

-- Enable ---------------------------------------------------------------------

alter table public.profiles             enable row level security;
alter table public.spaces               enable row level security;
alter table public.space_members        enable row level security;
alter table public.sedes                enable row level security;
alter table public.tasks                enable row level security;
alter table public.task_assignees       enable row level security;
alter table public.task_comments        enable row level security;
alter table public.attachments          enable row level security;
alter table public.task_recurrences     enable row level security;
alter table public.recurrence_assignees enable row level security;

-- profiles -------------------------------------------------------------------
-- Readable by everyone so the assignee picker works. Writable only by admins:
-- self-update is deliberately not allowed, because a self-update policy would
-- let a staff member set their own role to 'admin'.

create policy profiles_select on public.profiles
  for select to authenticated
  using (true);

create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (public.is_admin());

create policy profiles_update on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- spaces ---------------------------------------------------------------------
-- A private space row does not exist for non-members. This is what makes the
-- section invisible rather than merely locked, and it is why the sidebar can be
-- rendered straight from this table with no conditionals.

create policy spaces_select on public.spaces
  for select to authenticated
  using (not is_private or public.is_space_member(id));

-- Clients may only ever create public spaces. Private spaces are created by
-- migration, where the table owner bypasses RLS.
create policy spaces_insert on public.spaces
  for insert to authenticated
  with check (public.is_admin() and not is_private);

create policy spaces_update on public.spaces
  for update to authenticated
  using (
    (is_private and public.is_space_member(id))
    or (not is_private and public.is_admin())
  )
  with check (
    (is_private and public.is_space_member(id))
    or (not is_private and public.is_admin())
  );

-- space_members --------------------------------------------------------------
-- Membership of a private space is managed only by existing members.

create policy space_members_select on public.space_members
  for select to authenticated
  using (
    not public.is_private_space(space_id)
    or public.is_space_member(space_id)
  );

create policy space_members_insert on public.space_members
  for insert to authenticated
  with check (
    case
      when public.is_private_space(space_id) then public.is_space_member(space_id)
      else public.is_admin()
    end
  );

create policy space_members_delete on public.space_members
  for delete to authenticated
  using (
    case
      when public.is_private_space(space_id) then public.is_space_member(space_id)
      else public.is_admin()
    end
  );

-- sedes ----------------------------------------------------------------------

create policy sedes_select on public.sedes
  for select to authenticated
  using (true);

create policy sedes_insert on public.sedes
  for insert to authenticated
  with check (public.is_admin());

create policy sedes_update on public.sedes
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- tasks ----------------------------------------------------------------------
-- One gate. If you can see the space, you can see its tasks.

create policy tasks_read on public.tasks
  for select to authenticated
  using (
    not public.is_private_space(space_id)
    or public.is_space_member(space_id)
  );

create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (
      not public.is_private_space(space_id)
      or public.is_space_member(space_id)
    )
  );

create policy tasks_update on public.tasks
  for update to authenticated
  using (
    case
      when public.is_private_space(space_id) then public.is_space_member(space_id)
      else public.is_task_assignee(id)
        or created_by = auth.uid()
        or public.is_admin()
    end
  )
  with check (
    case
      when public.is_private_space(space_id) then public.is_space_member(space_id)
      else public.is_task_assignee(id)
        or created_by = auth.uid()
        or public.is_admin()
    end
  );

create policy tasks_delete on public.tasks
  for delete to authenticated
  using (
    case
      when public.is_private_space(space_id) then public.is_space_member(space_id)
      else created_by = auth.uid() or public.is_admin()
    end
  );

-- task_assignees -------------------------------------------------------------

create policy task_assignees_select on public.task_assignees
  for select to authenticated
  using (public.can_read_task(task_id));

create policy task_assignees_insert on public.task_assignees
  for insert to authenticated
  with check (public.can_write_task(task_id));

create policy task_assignees_delete on public.task_assignees
  for delete to authenticated
  using (public.can_write_task(task_id));

-- task_comments --------------------------------------------------------------
-- Anyone who can read a task can comment on it. Editing is author-only.
-- An admin may delete a comment, but only on a task they can read, so admin
-- rights still do not reach into a private space.

create policy task_comments_select on public.task_comments
  for select to authenticated
  using (public.can_read_task(task_id));

create policy task_comments_insert on public.task_comments
  for insert to authenticated
  with check (author_id = auth.uid() and public.can_read_task(task_id));

create policy task_comments_update on public.task_comments
  for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy task_comments_delete on public.task_comments
  for delete to authenticated
  using (
    author_id = auth.uid()
    or (public.is_admin() and public.can_read_task(task_id))
  );

-- attachments ----------------------------------------------------------------

create policy attachments_select on public.attachments
  for select to authenticated
  using (public.can_read_task(task_id));

create policy attachments_insert on public.attachments
  for insert to authenticated
  with check (uploaded_by = auth.uid() and public.can_write_task(task_id));

create policy attachments_delete on public.attachments
  for delete to authenticated
  using (
    uploaded_by = auth.uid()
    or (public.is_admin() and public.can_read_task(task_id))
  );

-- task_recurrences -----------------------------------------------------------

create policy task_recurrences_select on public.task_recurrences
  for select to authenticated
  using (
    not public.is_private_space(space_id)
    or public.is_space_member(space_id)
  );

create policy task_recurrences_insert on public.task_recurrences
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (
      not public.is_private_space(space_id)
      or public.is_space_member(space_id)
    )
  );

create policy task_recurrences_update on public.task_recurrences
  for update to authenticated
  using (
    case
      when public.is_private_space(space_id) then public.is_space_member(space_id)
      else created_by = auth.uid() or public.is_admin()
    end
  )
  with check (
    case
      when public.is_private_space(space_id) then public.is_space_member(space_id)
      else created_by = auth.uid() or public.is_admin()
    end
  );

create policy task_recurrences_delete on public.task_recurrences
  for delete to authenticated
  using (
    case
      when public.is_private_space(space_id) then public.is_space_member(space_id)
      else created_by = auth.uid() or public.is_admin()
    end
  );

-- recurrence_assignees -------------------------------------------------------

create policy recurrence_assignees_select on public.recurrence_assignees
  for select to authenticated
  using (public.can_read_recurrence(recurrence_id));

create policy recurrence_assignees_insert on public.recurrence_assignees
  for insert to authenticated
  with check (public.can_write_recurrence(recurrence_id));

create policy recurrence_assignees_delete on public.recurrence_assignees
  for delete to authenticated
  using (public.can_write_recurrence(recurrence_id));
