-- =====================================================================
--  BH-F-CCA-006 — Control de Calidad de Arándanos
--  Esquema Supabase (PostgreSQL): tablas, índices, RLS y funciones RPC.
--  Ejecutar en: Supabase Studio → SQL Editor (o supabase db push).
-- =====================================================================

-- Extensiones -----------------------------------------------------------
create extension if not exists "pgcrypto";

-- =====================================================================
--  PERFILES DE USUARIO (rol: inspector | jefatura)
-- =====================================================================
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nombre     text not null default '',
  dni        text default '',
  rol        text not null default 'inspector' check (rol in ('inspector','jefatura')),
  created_at timestamptz not null default now()
);

-- Crea el perfil automáticamente al registrarse un usuario.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, nombre)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', new.email))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: ¿el usuario actual es Jefatura de Calidad?
create or replace function public.is_jefatura()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.rol = 'jefatura'
  );
$$;

-- =====================================================================
--  MUESTRAS (lote / código ME-XXXXX) — cabecera repetida del maestro
-- =====================================================================
create table if not exists public.muestras (
  id                 uuid primary key default gen_random_uuid(),
  codigo             text not null,
  id_maestro         integer,
  semana             integer,
  fecha_cosecha      date,
  fecha_empaque      date,
  n_planta           integer,
  linea              text default '',
  turno              text default 'DÍA',
  productor          text default '',
  cliente            text default '',
  destino            text default '',
  formato            text default '',
  calibre            text default '',
  embalaje_caja      text default '',
  embalaje_clamshell text default '',
  variedad           text default '',
  intervalo_cosecha  text default '',
  dni_inspector      text default '',
  inspector          text default '',
  supervisor         text default '',
  dni_empacador      text default '',
  empacador          text default '',
  peso_establecido   numeric,
  medida_correctiva  text default 'NO',
  observaciones      text default '',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         text default ''
);

create index if not exists idx_muestras_semana    on public.muestras(semana);
create index if not exists idx_muestras_empacador  on public.muestras(empacador);
create index if not exists idx_muestras_empaque    on public.muestras(fecha_empaque);
create index if not exists idx_muestras_codigo     on public.muestras(codigo);

-- =====================================================================
--  CLAMSHELLS — una fila del Excel maestro por clamshell
-- =====================================================================
create table if not exists public.clamshells (
  id                    uuid primary key default gen_random_uuid(),
  muestra_id            uuid not null references public.muestras(id) on delete cascade,
  n_clamshell           integer not null,
  peso                  numeric,
  n_bayas_evaluadas     integer not null default 99,
  counts                jsonb   not null default '{}'::jsonb, -- { defect_key: cantidad }
  nota                  integer,
  peso_correcto         boolean default true,
  trazabilidad_conforme boolean default true,
  calibre_correcto      boolean default true,
  observacion           text default '',
  unique (muestra_id, n_clamshell)
);

create index if not exists idx_clamshells_muestra on public.clamshells(muestra_id);

-- =====================================================================
--  CATÁLOGO DE DEFECTOS (para cálculos en servidor)
-- =====================================================================
create table if not exists public.defect_catalog (
  key      text primary key,
  label    text not null,
  category text not null check (category in ('aprovechable','descarte'))
);

insert into public.defect_catalog (key, label, category) values
  ('desgarro_leve_seco','DESGARRO LEVE SECO','aprovechable'),
  ('corola','PRESENCIA DE COROLA','aprovechable'),
  ('resto_floral_verde','PRESENCIA DE RESTO FLORAL VERDE','aprovechable'),
  ('pedunculo','PRESENCIA DE PEDÚNCULO','aprovechable'),
  ('poca_bloom','POCA PRESENCIA DE BLOOM','aprovechable'),
  ('rojo_grado_1','ROJO GRADO 1','aprovechable'),
  ('aro_pedicelar_verde_leve','ARO PEDICELAR VERDE LEVE','aprovechable'),
  ('trips_leve','DAÑO DE TRIPS LEVE','aprovechable'),
  ('insercion_pedunculo_leve','INSERCIÓN DE PEDÚNCULO LEVE','aprovechable'),
  ('polvo_leve','POLVO LEVE','aprovechable'),
  ('deforme','DEFORME','aprovechable'),
  ('cera_abeja','CERA DE ABEJA','aprovechable'),
  ('deshidratado_leve','DESHIDRATADO LEVE','descarte'),
  ('deshidratado_extremo','DESHIDRATADO EXTREMO','descarte'),
  ('deshidratado_inmaduro','DESHIDRATADO INMADURO','descarte'),
  ('desgarro_leve_mojado','DESGARRO LEVE MOJADO','descarte'),
  ('pulpa_expuesta','PULPA EXPUESTA','descarte'),
  ('partidos_rajados','PARTIDOS/RAJADOS','descarte'),
  ('insercion_pedunculo_extremo','INSERCIÓN DE PEDÚNCULO EXTREMO','descarte'),
  ('exudados','EXUDADOS','descarte'),
  ('aplastados','APLASTADOS','descarte'),
  ('desgarro_grado_2','DESGARRO GRADO 2 A MÁS','descarte'),
  ('blando','BLANDO','descarte'),
  ('colapsado','COLAPSADO','descarte'),
  ('picado_ave','PICADO DE AVE','descarte'),
  ('picado_ave_pudricion','PICADO DE AVE CON PUDRICIÓN','descarte'),
  ('podrido','PODRIDO','descarte'),
  ('hongo','HONGO','descarte'),
  ('fumagina','FUMAGINA','descarte'),
  ('larva','PRESENCIA DE LARVA','descarte'),
  ('vestigios','VESTIGIOS','descarte'),
  ('chanchito_blanco','CHANCHITO BLANCO','descarte'),
  ('excreta_ave','EXCRETA DE AVE','descarte'),
  ('picado_insectos','PICADO DE INSECTOS','descarte'),
  ('rojo_grado_2','ROJO GRADO 2 A MÁS','descarte'),
  ('inmaduro_verde','IMMADURO VERDE','descarte'),
  ('desorden_maduracion','DESORDEN POR MADURACIÓN','descarte'),
  ('polvo_extremo','POLVO EXTREMO','descarte'),
  ('aro_pedicelar_verde_extremo','ARO PEDICELAR VERDE EXTREMO','descarte'),
  ('trips_extremo','DAÑO DE TRIPS EXTREMO','descarte'),
  ('dano_mecanico','DAÑO MECÁNICO','descarte'),
  ('mancha_aplicacion','MANCHA DE APLICACIÓN','descarte'),
  ('cera_abeja_extremo','CERA DE ABEJA EXTREMO','descarte'),
  ('sin_bloom','SIN BLOOM','descarte'),
  ('bajo_calibre','BAJO CALIBRE <10 mm','descarte')
on conflict (key) do update set label = excluded.label, category = excluded.category;

-- =====================================================================
--  updated_at automático en muestras
-- =====================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_muestras_touch on public.muestras;
create trigger trg_muestras_touch
  before update on public.muestras
  for each row execute function public.touch_updated_at();

-- =====================================================================
--  VISTA: estadísticas por clamshell (expande counts jsonb)
-- =====================================================================
create or replace view public.clamshell_stats as
select
  c.id,
  c.muestra_id,
  c.n_clamshell,
  c.n_bayas_evaluadas,
  coalesce(sum(case when d.category = 'aprovechable' then (e.value)::int else 0 end), 0) as aprovechable_bayas,
  coalesce(sum(case when d.category = 'descarte'     then (e.value)::int else 0 end), 0) as descarte_bayas,
  coalesce(sum((e.value)::int), 0) as total_defectos
from public.clamshells c
left join lateral jsonb_each_text(c.counts) as e(key, value) on true
left join public.defect_catalog d on d.key = e.key
group by c.id, c.muestra_id, c.n_clamshell, c.n_bayas_evaluadas;

-- =====================================================================
--  RPC: rendimiento por empacador
--  Devuelve, por empacador, N° de muestras, % descarte y % Cat 1 promedio.
-- =====================================================================
create or replace function public.rendimiento_empacador(p_semana integer default null)
returns table (
  empacador text,
  muestras bigint,
  total_bayas bigint,
  pct_descarte numeric,
  pct_cat1 numeric
)
language sql stable security definer as $$
  with base as (
    select m.id as muestra_id, m.empacador,
           sum(cs.n_bayas_evaluadas) as bayas,
           sum(cs.descarte_bayas)   as descarte,
           sum(cs.aprovechable_bayas) as aprov
    from public.muestras m
    join public.clamshell_stats cs on cs.muestra_id = m.id
    where (p_semana is null or m.semana = p_semana)
    group by m.id, m.empacador
  )
  select
    coalesce(empacador,'(sin empacador)') as empacador,
    count(*)                              as muestras,
    sum(bayas)::bigint                    as total_bayas,
    round(avg(case when bayas>0 then descarte::numeric/bayas else 0 end), 4) as pct_descarte,
    round(avg(case when bayas>0 then (bayas-descarte-aprov)::numeric/bayas else 0 end), 4) as pct_cat1
  from base
  group by coalesce(empacador,'(sin empacador)')
  order by pct_descarte desc;
$$;

-- =====================================================================
--  RPC: rendimiento semanal
-- =====================================================================
create or replace function public.rendimiento_semanal()
returns table (
  semana integer,
  muestras bigint,
  total_bayas bigint,
  pct_descarte numeric,
  pct_cat1 numeric
)
language sql stable security definer as $$
  with base as (
    select m.id as muestra_id, m.semana,
           sum(cs.n_bayas_evaluadas) as bayas,
           sum(cs.descarte_bayas)   as descarte,
           sum(cs.aprovechable_bayas) as aprov
    from public.muestras m
    join public.clamshell_stats cs on cs.muestra_id = m.id
    group by m.id, m.semana
  )
  select
    semana,
    count(*)          as muestras,
    sum(bayas)::bigint as total_bayas,
    round(avg(case when bayas>0 then descarte::numeric/bayas else 0 end), 4) as pct_descarte,
    round(avg(case when bayas>0 then (bayas-descarte-aprov)::numeric/bayas else 0 end), 4) as pct_cat1
  from base
  group by semana
  order by semana;
$$;

-- =====================================================================
--  ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles    enable row level security;
alter table public.muestras    enable row level security;
alter table public.clamshells  enable row level security;
alter table public.defect_catalog enable row level security;

-- profiles: cada quien ve/edita su propio perfil; jefatura ve todos.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_jefatura());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (id = auth.uid() or public.is_jefatura());

-- Blindaje: la policy de arriba solo controla QUÉ FILA se puede editar, no
-- QUÉ COLUMNA — sin esto, cualquier "inspector" podría hacer un PATCH a su
-- propia fila y auto-asignarse rol='jefatura' desde el navegador (probado:
-- funciona con un simple fetch autenticado, sin nada especial). Este trigger
-- bloquea el cambio de `rol` salvo que quien edita ya sea jefatura.
create or replace function public.prevent_self_role_escalation()
returns trigger language plpgsql as $$
begin
  if new.rol is distinct from old.rol and not public.is_jefatura() then
    raise exception 'No autorizado para cambiar el rol de un perfil';
  end if;
  return new;
end; $$;

drop trigger if exists trg_profiles_protect_rol on public.profiles;
create trigger trg_profiles_protect_rol
  before update on public.profiles
  for each row execute function public.prevent_self_role_escalation();

-- defect_catalog: lectura para todos los autenticados.
drop policy if exists defcat_select on public.defect_catalog;
create policy defcat_select on public.defect_catalog
  for select to authenticated using (true);

-- muestras: lectura para todo autenticado; escritura por el creador o jefatura.
drop policy if exists muestras_select on public.muestras;
create policy muestras_select on public.muestras
  for select to authenticated using (true);
drop policy if exists muestras_insert on public.muestras;
create policy muestras_insert on public.muestras
  for insert to authenticated with check (true);
drop policy if exists muestras_update on public.muestras;
create policy muestras_update on public.muestras
  for update to authenticated
  using (created_by = auth.uid()::text or public.is_jefatura());
drop policy if exists muestras_delete on public.muestras;
create policy muestras_delete on public.muestras
  for delete to authenticated
  using (created_by = auth.uid()::text or public.is_jefatura());

-- clamshells: heredan del acceso a su muestra.
drop policy if exists clamshells_select on public.clamshells;
create policy clamshells_select on public.clamshells
  for select to authenticated using (true);
drop policy if exists clamshells_write on public.clamshells;
create policy clamshells_write on public.clamshells
  for all to authenticated
  using (
    exists (select 1 from public.muestras m
            where m.id = muestra_id
              and (m.created_by = auth.uid()::text or public.is_jefatura()))
  )
  with check (true);

-- =====================================================================
--  REALTIME
-- =====================================================================
alter publication supabase_realtime add table public.muestras;
alter publication supabase_realtime add table public.clamshells;

-- Fin del script.
