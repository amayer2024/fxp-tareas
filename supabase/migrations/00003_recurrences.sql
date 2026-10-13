-- P0-3: recurring task templates.
-- The generator function itself is P4; the schema lands now so RLS covers it
-- from the start rather than being retrofitted.

create table public.task_recurrences (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces,
  sede_id uuid references public.sedes,
  title text not null check (length(trim(title)) between 1 and 200),
  notes text,
  priority public.task_priority not null default 'medium',
  freq public.recur_freq not null,
  weekday smallint check (weekday between 0 and 6),
  month_day smallint check (month_day between 1 and 28),
  active boolean not null default true,
  starts_on date not null default current_date,
  created_by uuid not null references public.profiles,
  created_at timestamptz not null default now(),
  -- weekly uses weekday, monthly uses month_day, never both.
  constraint freq_has_its_field check (
    (freq = 'weekly' and weekday is not null and month_day is null)
    or (freq = 'monthly' and month_day is not null and weekday is null)
  )
);

create index task_recurrences_space_active_idx
  on public.task_recurrences (space_id, active);

-- Mirrors task_assignees so the generator is a copy rather than a translation.
create table public.recurrence_assignees (
  recurrence_id uuid not null references public.task_recurrences on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  primary key (recurrence_id, user_id)
);

alter table public.tasks
  add column recurrence_id uuid references public.task_recurrences on delete set null;

-- This index is what makes lazy generation safe. The generator inserts with
-- `on conflict do nothing`, so two people opening /hoy at the same moment cannot
-- produce duplicate occurrences, and calling it repeatedly is free.
create unique index tasks_recurrence_due_idx
  on public.tasks (recurrence_id, due_date)
  where recurrence_id is not null;
