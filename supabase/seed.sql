-- Local development seed. Fixed UUIDs so rls.test.sql can assert exact counts.
--
-- Insert order matters. Table-owner writes bypass RLS, but the private-space
-- triggers in 00005 still fire, so space_members must exist before Dirección
-- tasks. The notification trigger skips when auth.uid() is null, so seed
-- assignments do not spam the bell.
--
-- Logins: first name (david, marjorie, mariam, alex, helen). Passwords below.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.seed_auth_user(
  p_id uuid,
  p_email text,
  p_name text,
  p_password text
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000',
    p_id,
    'authenticated',
    'authenticated',
    p_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_name),
    now(), now(), '', '', '', ''
  )
  on conflict (id) do nothing;

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(),
    p_id,
    jsonb_build_object('sub', p_id::text, 'email', p_email),
    'email',
    p_id::text,
    now(), now(), now()
  )
  on conflict do nothing;
end;
$$;

-- People ---------------------------------------------------------------------
-- 0003 is a test-only admin who is NOT in Dirección. That account exists so
-- the privacy tests have an admin to fail against.

select public.seed_auth_user('a0000000-0000-0000-0000-000000000001', 'david@futbolpormipais.org',    'David Mayer',      'ohEQFMEhYAA4');
select public.seed_auth_user('a0000000-0000-0000-0000-000000000002', 'marjorie@futbolpormipais.org', 'Marjorie Méndez',  'cjho5eXe6Wj7');
select public.seed_auth_user('a0000000-0000-0000-0000-000000000003', 'prueba@futbolpormipais.org',   'Cuenta de prueba', 'rXAd3iqkYTbR');
select public.seed_auth_user('a0000000-0000-0000-0000-000000000004', 'mariam@futbolpormipais.org',   'Mariam',           'EmjiMpFqLhq5');
select public.seed_auth_user('a0000000-0000-0000-0000-000000000005', 'alex@futbolpormipais.org',     'Alex',             'Zr7zfnrfuUAR');
select public.seed_auth_user('a0000000-0000-0000-0000-000000000006', 'helen@futbolpormipais.org',    'Helen',            'thxfzY7yMDQv');
select public.seed_auth_user('a0000000-0000-0000-0000-000000000007', 'test@futbolpormipais.org',     'Test',             'fxp-test');

insert into public.profiles (id, full_name, title, role) values
  ('a0000000-0000-0000-0000-000000000001', 'David Mayer',     'Fundador y Presidente', 'admin'),
  ('a0000000-0000-0000-0000-000000000002', 'Marjorie Méndez', 'Asistente Ejecutiva',   'admin'),
  ('a0000000-0000-0000-0000-000000000003', 'Cuenta de prueba','Pruebas',               'admin'),
  ('a0000000-0000-0000-0000-000000000004', 'Mariam',          null,                    'staff'),
  ('a0000000-0000-0000-0000-000000000005', 'Alex',            null,                    'staff'),
  ('a0000000-0000-0000-0000-000000000006', 'Helen',           null,                    'staff'),
  ('a0000000-0000-0000-0000-000000000007', 'Test',            'Pruebas',               'admin')
on conflict (id) do update
set full_name = excluded.full_name,
    title     = excluded.title,
    role      = excluded.role;

-- Spaces ---------------------------------------------------------------------

insert into public.spaces (id, slug, name, is_private, sort_order) values
  ('b0000000-0000-0000-0000-000000000009', 'direccion',   'Dirección',   true,  0),
  ('b0000000-0000-0000-0000-000000000001', 'operaciones', 'Operaciones', false, 1),
  ('b0000000-0000-0000-0000-000000000002', 'alianzas',    'Alianzas',    false, 2)
on conflict (id) do update
set slug       = excluded.slug,
    name       = excluded.name,
    is_private = excluded.is_private,
    sort_order = excluded.sort_order;

-- Dirección: David, Marjorie (+ Test, local only)
-- Operaciones: David, Marjorie, Mariam, Alex (+ prueba and Test)
-- Alianzas: David, Marjorie, Mariam, Helen (+ Test)
insert into public.space_members (space_id, user_id) values
  ('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000007'),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003'),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004'),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005'),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000007'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000006'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000007')
on conflict do nothing;

-- Sedes ----------------------------------------------------------------------

insert into public.sedes (id, slug, name, sort_order) values
  ('d0000000-0000-0000-0000-000000000001', 'santa-teresa',      'Santa Teresa',        1),
  ('d0000000-0000-0000-0000-000000000002', 'cobano',            'Cóbano',              2),
  ('d0000000-0000-0000-0000-000000000003', 'san-isidro',        'San Isidro',          3),
  ('d0000000-0000-0000-0000-000000000004', 'malpais',           'Malpaís',             4),
  ('d0000000-0000-0000-0000-000000000005', 'cabuya',            'Cabuya',              5),
  ('d0000000-0000-0000-0000-000000000006', 'montezuma',         'Montezuma',           6),
  ('d0000000-0000-0000-0000-000000000007', 'peninsula-nicoya',  'Península de Nicoya', 7),
  ('d0000000-0000-0000-0000-000000000008', 'los-cuadros',       'Los Cuadros, Purral', 8)
on conflict (id) do nothing;

-- Tasks: 3 Operaciones, 3 Alianzas, 3 Dirección -----------------------------

insert into public.tasks (
  id, title, notes, space_id, sede_id, due_date, priority, status, created_by
) values
  ('c0000000-0000-0000-0000-000000000001',
   'Confirmar canchas para la clínica de Santa Teresa',
   'Hablar con la asociación de desarrollo sobre el horario de la tarde.',
   'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
   current_date + 3, 'medium', 'open', 'a0000000-0000-0000-0000-000000000002'),

  ('c0000000-0000-0000-0000-000000000003',
   'Comprar balones y petos para Cóbano',
   null,
   'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002',
   current_date + 5, 'medium', 'open', 'a0000000-0000-0000-0000-000000000003'),

  ('c0000000-0000-0000-0000-000000000005',
   'Coordinar transporte para el Torneo Fútbol para la Convivencia',
   'Dos buses desde Cóbano y uno desde Montezuma.',
   'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000006',
   current_date + 1, 'urgent', 'in_progress', 'a0000000-0000-0000-0000-000000000003'),

  ('c0000000-0000-0000-0000-000000000002',
   'Enviar informe trimestral a Fundación Selección Colombia',
   null,
   'b0000000-0000-0000-0000-000000000002', null,
   current_date + 10, 'high', 'open', 'a0000000-0000-0000-0000-000000000002'),

  ('c0000000-0000-0000-0000-000000000004',
   'Actualizar la lista de voluntarios activos',
   null,
   'b0000000-0000-0000-0000-000000000002', null,
   null, 'low', 'open', 'a0000000-0000-0000-0000-000000000002'),

  ('c0000000-0000-0000-0000-000000000006',
   'Recoger testimonios de padres en San Isidro',
   null,
   'b0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003',
   current_date - 2, 'medium', 'done', 'a0000000-0000-0000-0000-000000000002'),

  ('c0000000-0000-0000-0000-0000000000f1',
   'Revisar presupuesto 2027 antes de la junta',
   null,
   'b0000000-0000-0000-0000-000000000009', null,
   current_date + 7, 'urgent', 'open', 'a0000000-0000-0000-0000-000000000001'),

  ('c0000000-0000-0000-0000-0000000000f2',
   'Preparar propuesta de renovación para Nantipa',
   null,
   'b0000000-0000-0000-0000-000000000009', null,
   current_date + 14, 'high', 'open', 'a0000000-0000-0000-0000-000000000002'),

  ('c0000000-0000-0000-0000-0000000000f3',
   'Definir ajustes salariales del equipo técnico',
   'Confidencial hasta la aprobación de la junta.',
   'b0000000-0000-0000-0000-000000000009', null,
   null, 'high', 'open', 'a0000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

insert into public.task_assignees (task_id, user_id) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004'),
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005'),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004'),
  ('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000003'),
  ('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000004'),
  ('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000005'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002'),
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000006'),
  ('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000006'),
  ('c0000000-0000-0000-0000-0000000000f1', 'a0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-0000000000f1', 'a0000000-0000-0000-0000-000000000002'),
  ('c0000000-0000-0000-0000-0000000000f2', 'a0000000-0000-0000-0000-000000000002'),
  ('c0000000-0000-0000-0000-0000000000f3', 'a0000000-0000-0000-0000-000000000001')
on conflict do nothing;

insert into public.task_comments (id, task_id, author_id, body) values
  ('e0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000004',
   'La cancha está libre después de las 3 pm.'),
  ('e0000000-0000-0000-0000-0000000000f1',
   'c0000000-0000-0000-0000-0000000000f3',
   'a0000000-0000-0000-0000-000000000002',
   'Adjunto el comparativo con el año pasado.')
on conflict (id) do nothing;

insert into public.task_recurrences (
  id, space_id, sede_id, title, priority, freq, weekday, month_day, created_by
) values
  ('f0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000001', null,
   'Reporte semanal de asistencia por sede',
   'medium', 'weekly', 1, null,
   'a0000000-0000-0000-0000-000000000002'),
  ('f0000000-0000-0000-0000-0000000000f1',
   'b0000000-0000-0000-0000-000000000009', null,
   'Actualización mensual a la junta directiva',
   'high', 'monthly', null, 1,
   'a0000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

insert into public.recurrence_assignees (recurrence_id, user_id) values
  ('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004'),
  ('f0000000-0000-0000-0000-0000000000f1', 'a0000000-0000-0000-0000-000000000001'),
  ('f0000000-0000-0000-0000-0000000000f1', 'a0000000-0000-0000-0000-000000000002')
on conflict do nothing;
