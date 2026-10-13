-- P0-2: tasks, assignees, comments, attachments.

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 200),
  notes text,
  space_id uuid not null references public.spaces,
  sede_id uuid references public.sedes,
  due_date date,
  priority public.task_priority not null default 'medium',
  status public.task_status not null default 'open',
  created_by uuid not null references public.profiles,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint done_has_timestamp
    check ((status = 'done') = (completed_at is not null))
);

create index tasks_space_status_due_idx on public.tasks (space_id, status, due_date);
create index tasks_created_by_status_idx on public.tasks (created_by, status);
create index tasks_due_date_idx on public.tasks (due_date) where status in ('open', 'in_progress');

-- A task may be assigned to several people. There is deliberately no
-- tasks.assignee_id: this table is the only source of truth, so there is nothing
-- to keep in sync and no ambiguity about which column to filter on.
create table public.task_assignees (
  task_id uuid not null references public.tasks on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

create index task_assignees_user_idx on public.task_assignees (user_id);

-- Keep completed_at consistent with status on every write path, so the check
-- constraint above can never be tripped by a plain UPDATE. Doing this in a
-- trigger rather than in an RPC means direct updates behave correctly too.
create or replace function public.sync_task_completed_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'done' then
    new.completed_at := coalesce(
      case when tg_op = 'UPDATE' and old.status = 'done' then old.completed_at end,
      now()
    );
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger tasks_sync_completed_at
  before insert or update on public.tasks
  for each row execute function public.sync_task_completed_at();

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks on delete cascade,
  author_id uuid not null references public.profiles,
  body text not null check (length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index task_comments_task_created_idx
  on public.task_comments (task_id, created_at);

-- Bytes live in Supabase Storage; this table is metadata only.
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks on delete cascade,
  storage_path text not null unique,
  filename text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes <= 26214400),
  uploaded_by uuid not null references public.profiles,
  created_at timestamptz not null default now()
);

create index attachments_task_idx on public.attachments (task_id);
