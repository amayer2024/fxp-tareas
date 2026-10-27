-- Agregados de asistencia empujados semanalmente por el Apps Script en Drive.
-- Una fila por sede x mes x grupo etario x semana. Sin datos por participante:
-- nombres, edades y género nunca salen de Drive.

create table if not exists public.asistencia_agregados (
  sede                    text        not null,
  anio                    smallint    not null,
  mes_num                 smallint    not null check (mes_num between 1 and 12),
  mes                     text        not null,
  grupo_etario            text        not null,
  semana                  text        not null,
  fechas                  text,

  presente                integer     not null default 0,
  ausente_justificada     integer     not null default 0,
  ausente_injustificada   integer     not null default 0,
  sin_registro            integer     not null default 0,
  filas                   integer     not null default 0,
  filas_sesion_realizada  integer     not null default 0,

  -- presente / (presente + justificada + injustificada). El amarillo cuenta
  -- como ausencia, segun la regla acordada. Guardamos los conteos crudos para
  -- poder recalcular con otro denominador sin volver a importar.
  tasa_asistencia         numeric(6,4),

  generado                timestamptz not null,
  actualizado_en          timestamptz not null default now(),

  primary key (sede, anio, mes_num, grupo_etario, semana)
);

create index if not exists asistencia_agregados_periodo_idx
  on public.asistencia_agregados (anio, mes_num);
create index if not exists asistencia_agregados_sede_idx
  on public.asistencia_agregados (sede);

-- Registro de cada carga, para poder mostrar "ultima actualizacion" y detectar
-- que el Apps Script dejo de correr.
create table if not exists public.asistencia_cargas (
  id              bigint generated always as identity primary key,
  generado        timestamptz not null,
  filas_master    integer     not null default 0,
  filas_agregadas integer     not null default 0,
  recibido_en     timestamptz not null default now()
);

create index if not exists asistencia_cargas_recibido_idx
  on public.asistencia_cargas (recibido_en desc);

alter table public.asistencia_agregados enable row level security;
alter table public.asistencia_cargas    enable row level security;

-- Solo lectura para usuarios autenticados. No hay politicas de escritura: la
-- Edge Function escribe con el service role, que omite RLS. Esto mantiene la
-- regla del repo de que la app Next nunca usa el service role.
drop policy if exists "asistencia_agregados lectura" on public.asistencia_agregados;
create policy "asistencia_agregados lectura" on public.asistencia_agregados
  for select to authenticated using (true);

drop policy if exists "asistencia_cargas lectura" on public.asistencia_cargas;
create policy "asistencia_cargas lectura" on public.asistencia_cargas
  for select to authenticated using (true);
