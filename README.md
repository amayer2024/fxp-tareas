# FxP Tareas

Task tracker for Fútbol por mi País. `FXP_SPEC.md` is the authoritative document
for architecture decisions — read it before changing the data model.

## Requirements

- Node 22.x
- Docker Desktop, running
- Supabase CLI (`brew install supabase/tap/supabase`)

## Running locally

```bash
supabase start     # first run pulls containers, takes a few minutes
supabase db reset  # applies migrations in order, then seed.sql
supabase test db   # the RLS gate — must pass
npm run types      # regenerate lib/db/types.ts after a schema change
npm run dev        # app at http://localhost:3100
```

Ports are shifted +10 from the Supabase defaults so this stack runs alongside
Buena Vida's without a conflict:

| Service | FxP | (Buena Vida) |
| --- | --- | --- |
| API | 54331 | 54321 |
| Database | 54332 | 54322 |
| Studio | http://localhost:54333 | 54323 |
| Mail catcher | 54334 | 54324 |
| App | 3100 | 3000 |

If the Docker CLI is not on your `PATH`, Docker Desktop ships it at
`/Applications/Docker.app/Contents/Resources/bin`.

## Seeded accounts

Sign in with the first name. Each person has their own password.

| Username | Password | Who | Dirección | Operaciones | Alianzas |
| --- | --- | --- | --- | --- | --- |
| `David` | `ohEQFMEhYAA4` | David Mayer | yes | yes | yes |
| `Marjorie` | `cjho5eXe6Wj7` | Marjorie Méndez | yes | yes | yes |
| `Mariam` | `EmjiMpFqLhq5` | Mariam | no | yes | yes |
| `Alex` | `Zr7zfnrfuUAR` | Alex | no | yes | no |
| `Helen` | `thxfzY7yMDQv` | Helen | no | no | yes |
| `test` | `fxp-test` | Local tester (admin) | yes | yes | yes |
| `prueba` | `rXAd3iqkYTbR` | Cuenta de prueba (admin) | no | yes | no |

Dirección is private: it does not appear in the sidebar, and its tasks are
invisible, unless you are David or Marjorie. Being `admin` does not pierce that.
The `prueba@` account exists so the privacy tests have an admin to fail against.

Operaciones and Alianzas are not private, but they are still membership-only.
Alex does not see Alianzas. Helen does not see Operaciones.

## The one rule

Access control lives in Postgres row-level security, never in a JavaScript `if`.
Membership of a space is the only way into it — `is_admin()` must never appear
in a private-space branch of a policy. `supabase/tests/rls.test.sql` enforces
this.
