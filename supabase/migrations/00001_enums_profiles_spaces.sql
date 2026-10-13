-- P0-1: enums, profiles, spaces, space_members, sedes.

create type public.user_role as enum ('admin', 'staff');
create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.task_status as enum ('open', 'in_progress', 'done', 'cancelled');
create type public.recur_freq as enum ('weekly', 'monthly');

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  title text,
  role public.user_role not null default 'staff',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- A task lives in exactly one space. `is_private` is the whole access model:
-- see 00005_private_spaces.sql.
create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  is_private boolean not null default false,
  sort_order smallint not null default 0
);

create table public.space_members (
  space_id uuid not null references public.spaces on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

create index space_members_user_idx on public.space_members (user_id);

-- The communities FxP works in. A table and not an enum, because this list grows
-- and adding a community should not require a migration and a deploy.
create table public.sedes (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  active boolean not null default true,
  sort_order smallint not null default 0
);

-- Accounts are provisioned by scripts/provision-people.mjs, never self-registered.
-- This trigger only guarantees a profile row exists for any auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    'staff'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
