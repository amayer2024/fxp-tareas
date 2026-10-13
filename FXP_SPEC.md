# FxP Tareas — Build Spec

A task tracker for Fútbol por mi País (FxP), a Costa Rican non-profit using football
for youth development. It replaces the "where did we leave that" problem between the
President and his Executive Assistant, and gives the wider staff one shared list.

This is the authoritative document for architecture decisions. It is a deliberately
smaller sibling of Buena Vida OS (`../Buena Vida/BuenaVida-ChatBot/buena vida chatbot`)
and reuses its stack, conventions, and security philosophy.

**Status: P0 complete.** Migrations `00001`–`00007` apply cleanly and all 36
assertions in `supabase/tests/rls.test.sql` pass. P1 (login and a working list) is next.

---

## 1. Stack

Same as Buena Vida so knowledge transfers, minus everything AI.

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15, App Router, React Server Components |
| Language | TypeScript, `strict: true` |
| Runtime | Node 22.x |
| Package manager | npm |
| Database | Supabase Postgres. Raw SQL migrations, no ORM |
| Auth | Supabase Auth, email + password, `@supabase/ssr` |
| Files | Supabase Storage, private bucket, signed URLs |
| UI | Tailwind 3.4 + shadcn/ui (new-york), Radix, Lucide |
| Validation | Zod |
| Toasts | sonner |
| Dates | date-fns + date-fns-tz |
| Tests | Vitest for units, `supabase test db` for RLS |
| Deploy | Railway, standalone Next build |

Copy from Buena Vida rather than rewrite: `lib/supabase/*`, `middleware.ts`,
`components/ui/*`, `lib/utils.ts`, `next.config.ts`, `railway.json`,
`scripts/prepare-standalone.js`.

### Not built

These exist in Buena Vida and are **out of scope here**. Listed explicitly so nobody
ports them by reflex:

- The Anthropic agent, tool loop, prompts, `/chat`, SSE streaming
- Direct messages, team rooms, Slack-style channels
- Gmail OAuth and the `/correo` inbox
- Daily email digest, Resend, `digest_runs`, cron routes
- Web push, service worker, PWA install prompt
- The i18n layer. **This app is Spanish only** — strings live in the components
- `task_visibility` (`team` | `restricted`), the `full_access` flag, the `guest` role.
  Buena Vida needs per-task visibility because it has an assistant doing scoped reads.
  Here, visibility is a property of the *space*, which is far easier to reason about.

---

## 2. The organisation

### People

From futbolxmipais.com, in rough order of how much they'll use this:

| Person | Title | Role |
| --- | --- | --- |
| David Mayer | Fundador, Presidente | `admin` + Dirección |
| Marjorie Méndez | Asistente Ejecutiva | `admin` + Dirección |
| — | Fundadora, Vicepresidente | `staff` |
| — | Director Ejecutivo | `staff` |
| Entrenadores, voluntarios, jóvenes líderes | | `staff` |

**No self-registration.** Accounts are created by a provisioning script
(`scripts/provision-people.mjs`, ported from Buena Vida) using the service role key.
Start with David and Marjorie only; add people as they're actually needed.

Two roles, not four:

- `admin` — may create and edit people, spaces, and sedes
- `staff` — may create tasks, and edit tasks they own or are assigned

Being `admin` grants **no special read access to tasks**. That is the single most
important rule in this document, and §4 explains why.

### Spaces

A task lives in exactly one space. Seeded with two:

| Space | `slug` | `is_private` | Who sees it |
| --- | --- | --- | --- |
| Dirección | `direccion` | `true` | David and Marjorie only, via membership |
| General | `general` | `false` | Every authenticated person |

The mental model is *if I can see the space, I can see its tasks.* There is no
per-task privacy switch to get wrong.

`spaces` is a table rather than an enum so a third space (say, a board for the
Torneo Fútbol para la Convivencia) is a row, not a migration.

### Sedes

FxP works across Santa Teresa, Cóbano, San Isidro, Malpaís, Cabuya, Montezuma, the
Península de Nicoya, and Los Cuadros de Purral. A task may optionally be tagged with
one. This is a lookup table, not an enum, because that list will keep growing and
adding a community should not require a deploy.

---

## 3. Data model

Ten tables. Buena Vida has around twenty.

```sql
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

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  is_private boolean not null default false,
  sort_order smallint not null default 0
);

create table public.space_members (
  space_id uuid references public.spaces on delete cascade,
  user_id uuid references public.profiles on delete cascade,
  primary key (space_id, user_id)
);

create table public.sedes (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  active boolean not null default true
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 200),
  notes text,
  space_id uuid not null references public.spaces,
  sede_id uuid references public.sedes,
  due_date date,
  priority public.task_priority not null default 'medium',
  status public.task_status not null default 'open',
  recurrence_id uuid references public.task_recurrences on delete set null,
  created_by uuid not null references public.profiles,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint done_has_timestamp
    check ((status = 'done') = (completed_at is not null))
);

create index tasks_space_status_due_idx on public.tasks (space_id, status, due_date);

-- A task may be assigned to several people. There is deliberately no
-- `tasks.assignee_id`: see the note below.
create table public.task_assignees (
  task_id uuid not null references public.tasks on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

create index task_assignees_user_idx on public.task_assignees (user_id);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks on delete cascade,
  author_id uuid not null references public.profiles,
  body text not null check (length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index task_comments_task_created_idx
  on public.task_comments (task_id, created_at);

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
```

Two notes on what is **absent**:

- There is no `task_events` audit table. Buena Vida needs one because an AI writes to
  tasks and you must be able to prove what it did. Here, a human comment thread is
  more useful to a secretary than a `jsonb` diff log, and `task_comments` does that job.
- There is **no `tasks.assignee_id` column.** Buena Vida has one *and* a
  `task_assignees` table, because multi-assignee was retrofitted in `00025` and the old
  column had to be kept and synced by trigger. Starting fresh, `task_assignees` is the
  single source of truth from day one. This removes the sync trigger, the drift between
  the two, and the question "which one do I filter on?" The cost is that every
  "my tasks" query joins, and the assignee picker always deals in arrays.

---

## 4. Access control

Access control lives in Postgres RLS. Never in a JavaScript `if`. All app database
access goes through the user's JWT via `supabase-js`. The service role key is used by
`scripts/provision-people.mjs` and nowhere else — there are no cron routes in this app.

### The rule that matters

**Membership of a private space is the only path into it. `admin` does not bypass it.**

This is lifted from Buena Vida's `00021_gally_naty_private.sql`, which solved the same
problem for two people there. The temptation is to write `or is_admin()` into the task
read policy as an escape hatch. Don't. The moment you do, the Dirección space is
readable by whoever you later make an admin, which defeats the entire feature. If David
loses access, a maintainer fixes it with a migration, not a role flag.

### Helpers

```sql
create or replace function public.is_space_member(s uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.space_members
    where space_id = s and user_id = auth.uid()
  );
$$;

create or replace function public.is_private_space(s uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select is_private from public.spaces where id = s), false);
$$;

create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_task_assignee(t uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.task_assignees
    where task_id = t and user_id = auth.uid()
  );
$$;
```

`is_task_assignee` **must** be `security definer`. The policy on `tasks` calls it, and
the policy on `task_assignees` reads `tasks`; without `definer` those two policies would
recurse. Being `definer` means the helper reads `task_assignees` with RLS bypassed,
which is safe because it only ever answers about `auth.uid()`.

Each gets `revoke all ... from public` then `grant execute ... to authenticated`.

### Policies

```sql
-- A private space row does not exist for non-members. This is what makes the
-- section invisible rather than merely locked.
create policy spaces_select on public.spaces
  for select to authenticated
  using (not is_private or public.is_space_member(id));

create policy space_members_select on public.space_members
  for select to authenticated
  using (not public.is_private_space(space_id) or public.is_space_member(space_id));

-- Tasks: one gate, read and write.
create policy tasks_read on public.tasks
  for select to authenticated
  using (
    case
      when public.is_private_space(space_id) then public.is_space_member(space_id)
      else true
    end
  );

create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (not public.is_private_space(space_id) or public.is_space_member(space_id))
  );

create policy tasks_update on public.tasks
  for update to authenticated
  using (
    case
      when public.is_private_space(space_id) then public.is_space_member(space_id)
      else public.is_task_assignee(id) or created_by = auth.uid() or public.is_admin()
    end
  )
  with check (same as using);
```

`task_assignees`, `task_comments` and `attachments` inherit their parent task's rule via
`exists (select 1 from public.tasks t where t.id = task_id)` — RLS on `tasks` means the
subquery returns nothing for a task you cannot read, so the child row is invisible too.

### Guard triggers

Three, the first two ported from Buena Vida:

1. `guard_private_space` — `before update of is_private` on `spaces`, raises if a
   private space is flipped public. Prevents a client from un-privating Dirección.
2. `enforce_private_space_task` — `before insert or update of space_id, created_by` on
   `tasks`, raises if the creator is not a member, or if moving a task into a private
   space would carry non-member assignees with it.
3. `enforce_private_space_assignee` — `before insert or update` on `task_assignees`,
   raises if the person is not a member of the task's private space.

The third trigger is the one multi-assignee makes necessary, and it is easy to miss.
Without it, the path out of the private space is: create a Dirección task, then add an
outsider as a second assignee. They would then have read access to a task in a space
they cannot otherwise see. Both triggers are needed because `tasks` and `task_assignees`
are written independently.

### Invisibility in the app layer

RLS makes the data invisible; the UI must not undo that.

- **The sidebar is rendered from a `select * from spaces` query, never a hardcoded
  list.** Dirección appears for David and Marjorie and is absent for everyone else,
  automatically, with no conditional in the component.
- `/privado` calls `notFound()` for non-members, returning **404, not 403**. A 403
  confirms the section exists.
- No count, badge, or "1 hidden task" hint anywhere in shared views.

### RLS tests

`supabase/tests/rls.test.sql`, run by `supabase test db`, is a required gate. At minimum:

- A `staff` user selecting `tasks` gets zero Dirección rows
- An `admin` user who is not a Dirección member gets zero Dirección rows
- A `staff` user selecting `spaces` does not see the `direccion` row
- A `staff` user selecting `space_members` does not see the Dirección membership
- Adding a non-member as an assignee on a Dirección task raises
- An `admin` adding themselves to `space_members` for Dirección raises
- Updating `spaces.is_private` to `false` raises
- Moving a General task into Dirección while it has outside assignees raises
- `task_comments` and `attachments` on a Dirección task are invisible to `staff`

---

## 5. Recurring tasks

The one feature Buena Vida does not have, so it is designed here rather than ported.

```sql
create table public.task_recurrences (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces,
  sede_id uuid references public.sedes,
  title text not null,
  notes text,
  priority public.task_priority not null default 'medium',
  freq public.recur_freq not null,
  weekday smallint check (weekday between 0 and 6),      -- weekly
  month_day smallint check (month_day between 1 and 28),  -- monthly
  active boolean not null default true,
  starts_on date not null default current_date,
  created_by uuid not null references public.profiles,
  created_at timestamptz not null default now(),
  constraint freq_has_its_field check (
    (freq = 'weekly' and weekday is not null and month_day is null) or
    (freq = 'monthly' and month_day is not null and weekday is null)
  )
);

-- Who a generated task gets assigned to. Mirrors task_assignees so the spawn
-- function is a straight copy rather than a translation.
create table public.recurrence_assignees (
  recurrence_id uuid not null references public.task_recurrences on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  primary key (recurrence_id, user_id)
);

create unique index tasks_recurrence_due_idx
  on public.tasks (recurrence_id, due_date)
  where recurrence_id is not null;
```

`month_day` caps at 28 so a monthly task never silently skips February.

### Generation without a cron job

A scheduled worker would mean standing up cron infrastructure, a secret, and a
service-role endpoint, for an office that opens the app every morning anyway. Instead,
generation is **lazy and idempotent**:

A `security invoker` RPC `spawn_due_recurrences()` is called at the top of `/hoy`. For
each active recurrence the caller can read, it computes occurrence dates from
`greatest(starts_on, today)` through `today + 21 days` and inserts any missing tasks.

The unique index on `(recurrence_id, due_date)` is what makes this safe: the insert uses
`on conflict do nothing`, so two people loading `/hoy` at the same moment cannot create
duplicates, and calling it a hundred times a day is harmless. Because the RPC is
`security invoker`, RLS applies — it can only ever spawn tasks into spaces the caller
can already write to, so it cannot be used to probe Dirección.

**The tradeoff, stated plainly:** recurring tasks materialise when somebody opens the
app, not at midnight. With a 21-day horizon this is invisible in practice, and since
there is no email digest there is nothing that needs them to exist beforehand. If that
ever changes, the same RPC can be called from a cron route without modification.

---

## 6. Files

Buena Vida's model, unchanged: bytes in Supabase Storage, metadata in Postgres.

- One private bucket, `task-files`. Nothing public.
- Path convention `{task_id}/{uuid}-{filename}`.
- Upload via a short-lived signed upload URL from `POST /api/files/upload-url`,
  which checks the caller can write the task before signing.
- Download via a signed read URL, generated per request, expiring in minutes.
- 25 MB cap, enforced in the `size_bytes` check constraint and at the route.
- Storage RLS policies mirror the `attachments` table rule so a Dirección file is not
  reachable by guessing its path.

---

## 7. Screens

Seven routes. Buena Vida has ten top-level sections.

| Route | Purpose |
| --- | --- |
| `/entrar` | Email + password. No signup link |
| `/hoy` | **Home.** My overdue, due today, due this week. Quick-add box at top. Calls `spawn_due_recurrences()` |
| `/tareas` | Everything I can see. Filters: space, assignee, status, sede |
| `/tareas/[id]` | Detail. Notes, status, assignee, due date, comments, attachments |
| `/privado` | Dirección board. `notFound()` for non-members |
| `/recurrentes` | Manage recurring templates |
| `/equipo` | People directory. Editable by `admin` |

`/hoy` is the landing page after login. The quick-add box takes a title and nothing
else, defaulting to the General space, no assignee, no due date — because the thing
that kills a task tracker is a six-field form standing between a person and a thought.

Mobile layout is a first-class concern, not a stretch goal, since the eventual user
base includes field coaches on phones. A bottom tab bar on small screens, sidebar on
desktop.

### Data flow

Exactly Buena Vida's pattern, which needs no improvement:

- Pages are Server Components calling Supabase directly
- Mutations are server actions in a colocated `actions.ts`
- Every action: `getSessionProfile()` → Zod parse → query → `revalidatePath`
- Actions return `{ ok: true }` or `{ ok: false, detail: "..." }`
- No React Query, no SWR, no client store

---

## 8. Repo

The repo root is this folder, `Futbol x mi Pais/`. Deliberately flat — Buena Vida's
three-deep `Buena Vida/BuenaVida-ChatBot/buena vida chatbot/` nesting, with a space in
the final path segment, is a recurring annoyance in tooling and shell commands.

```
Futbol x mi Pais/
├── app/
│   ├── (auth)/entrar/
│   ├── (app)/
│   │   ├── hoy/
│   │   ├── tareas/[id]/
│   │   ├── privado/
│   │   ├── recurrentes/
│   │   ├── equipo/
│   │   └── layout.tsx          # auth gate + shell
│   ├── api/files/upload-url/
│   ├── api/health/
│   └── auth/callback/
├── components/{ui,tasks,nav,layout}/
├── lib/
│   ├── supabase/{server,client,middleware}.ts
│   ├── session.ts              # getSessionProfile, queries, Zod schemas
│   ├── spaces.ts
│   ├── recurrences.ts
│   └── db/types.ts             # generated
├── supabase/migrations/
├── supabase/tests/rls.test.sql
├── scripts/provision-people.mjs
└── middleware.ts
```

### Environment

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # provisioning script only
NEXT_PUBLIC_SITE_URL=http://localhost:3000
APP_TIMEZONE=America/Costa_Rica
STORAGE_BUCKET_TASKS=task-files
MAX_UPLOAD_BYTES=26214400
SENTRY_DSN=                       # optional
```

A **new, separate Supabase project** from Buena Vida. Different organisation, different
data, no reason to share a database or an auth user pool.

### Design tokens

FxP's identity is navy, cyan, and white — taken from [futbolxmipais.com](https://futbolxmipais.com/)
(header `#1B2B57`, headings `#0A71AD`, DONAR `#009EE0`). Buena Vida is pine, gold, and cream.
The white wordmark lives in `public/fxp-logo.svg`. Tokens go in `globals.css` and are mapped
in `tailwind.config.ts`, same as Buena Vida.

```css
:root {
  --pitch:  #1b2b57;  /* navy chrome, login, sidebar */
  --grass:  #0a71ad;  /* ocean blue, hover / secondary */
  --lime:   #009ee0;  /* cyan CTA, active nav */
  --paper:  #f4f7fb;  /* cool page background */
  --sheet:  #ffffff;  /* cards */
  --ink:    #12203a;  /* navy text */
  --overdue:#c0392b;  /* overdue only */
}
```

---

## 9. Build order

Each step ends somewhere usable. Nothing is built on an unverified foundation.

**P0 — data layer only. No UI.**
Migrations for all ten tables, enums, RLS helpers, policies, guard triggers. Seed the
two spaces and the sedes. Write `rls.test.sql` and get it green. Generate
`lib/db/types.ts`. The private-space rules are proven here, before any screen exists,
because they are the hardest thing to retrofit.

**P1 — login and a working list.**
Supabase clients, `middleware.ts`, `/entrar`, the app shell with a sidebar built from
`spaces`, `/hoy` with quick-add, `/tareas` with filters, `/tareas/[id]`. Create,
complete, reassign, reschedule. At the end of P1 David and Marjorie can actually use it.

**P2 — the private section.**
`/privado`, the `notFound()` behaviour, provision both accounts into Dirección
membership. Verify as a third `staff` account that the section is invisible: not in the
nav, 404 on the URL, zero rows in any shared query.

**P3 — comments and files.**
`task_comments` UI, the upload route, storage bucket and policies, attachment list.

**P4 — recurring.**
`spawn_due_recurrences()`, the `/recurrentes` screen, wire the call into `/hoy`.

**P5 — sedes, team directory, polish.**
Sede filter and picker, `/equipo`, mobile tab bar, empty states, Spanish copy pass.

Deploy to Railway at the end of P1 and after each phase thereafter. A tracker nobody
can reach from a phone is not a tracker.

---

## 10. Open questions

1. **Brand colours.** The palette above is inferred. Confirm against the FxP logo.
2. **Who else gets an account, and when.** P2 assumes a third test account exists;
   beyond that, expansion is deliberately deferred.
3. **Spanish only** is assumed throughout. If any board member or international partner
   needs English, say so before P1 — retrofitting i18n is far more expensive than
   including Buena Vida's two dictionary files from the start.
