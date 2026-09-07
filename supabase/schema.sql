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
  hora_evaluacion    text default '',
  fecha_cosecha      date,
  fecha_empaque      date,
  n_planta           integer,
  linea              text default '',
  turno              text default 'DÍA',
  productor          text default '',
  cliente            text default '',
  destino            text default '', -- determina la columna de tolerancia (ver defect_catalog / app)
  variedad           text default '',
  formato            text default '',
  tipo_empaque       text default '',
  calibre            text default '',
  embalaje_caja      text default '', -- si contiene "SWEETEST BATCH" + destino USA, tolerancia más estricta
  embalaje_clamshell text default '',
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
  n_bayas_evaluadas     integer not null default 99,
  counts                jsonb   not null default '{}'::jsonb, -- { defect_key: cantidad }
  nota                  integer,
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

-- Catálogo actualizado según la planilla del cliente ("BH-F-CCA-006. Base de
-- Datos ... (1).xlsx", hoja "Defectos"): 44 defectos (antes 45). Cambios:
-- SIN BLOOM pasó de descarte a aprovechable; se agregan MANCHAS EXTRAÑAS
-- (reemplaza a MANCHA DE APLICACIÓN) y se elimina CERA DE ABEJA EXTREMO.
delete from public.defect_catalog where key in ('mancha_aplicacion', 'cera_abeja_extremo');

insert into public.defect_catalog (key, label, category) values
  ('desgarro_leve_seco','DESGARRO LEVE SECO','aprovechable'),
  ('corola','PRESENCIA DE COROLA','aprovechable'),
  ('resto_floral_verde','PRESENCIA DE RESTO FLORAL VERDE','aprovechable'),
  ('pedunculo','PRESENCIA DE PEDÚNCULO','aprovechable'),
  ('poca_bloom','POCA PRESENCIA DE BLOOM','aprovechable'),
  ('sin_bloom','SIN BLOOM','aprovechable'),
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
  ('manchas_extranas','MANCHAS EXTRAÑAS','descarte'),
  ('bajo_calibre','BAJO CALIBRE','descarte')
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
--  RPC: escritura atómica de una muestra + sus clamshells
--
--  Reemplaza el patrón anterior del cliente (upsert de la muestra, luego
--  DELETE de todos sus clamshells, luego INSERT de los nuevos — 3 llamadas
--  sueltas, sin transacción: si la app se queda sin señal entre el DELETE y
--  el INSERT, la muestra queda sin clamshells en el servidor). Acá todo pasa
--  dentro de la transacción implícita de la función: o se aplica todo, o no
--  se aplica nada.
--
--  También resuelve conflictos de edición concurrente: si p_expected_updated_at
--  no coincide con el updated_at actual del servidor (alguien más lo cambió
--  después de que este dispositivo bajó su copia), no escribe nada y devuelve
--  is_conflict = true en vez de pisar silenciosamente el cambio ajeno.
--  Pasar p_expected_updated_at = null fuerza la escritura sin chequear
--  (se usa para "conservar mi versión" al resolver un conflicto a mano).
-- =====================================================================
create or replace function public.upsert_muestra_full(
  p_muestra jsonb,
  p_clamshells jsonb,
  p_expected_updated_at timestamptz default null
)
returns table (updated_at timestamptz, is_conflict boolean)
language plpgsql as $$
declare
  v_id uuid := (p_muestra->>'id')::uuid;
  v_current_updated_at timestamptz;
begin
  select m.updated_at into v_current_updated_at
  from public.muestras m where m.id = v_id;

  if v_current_updated_at is not null
     and p_expected_updated_at is not null
     and v_current_updated_at <> p_expected_updated_at then
    return query select v_current_updated_at, true;
    return;
  end if;

  insert into public.muestras (
    id, codigo, id_maestro, semana, hora_evaluacion, fecha_cosecha, fecha_empaque, n_planta, linea, turno,
    productor, cliente, destino, variedad, formato, tipo_empaque, calibre, embalaje_caja, embalaje_clamshell,
    intervalo_cosecha, dni_inspector, inspector, supervisor, dni_empacador,
    empacador, peso_establecido, medida_correctiva, observaciones, created_at, created_by
  )
  values (
    v_id,
    p_muestra->>'codigo', (p_muestra->>'id_maestro')::int, (p_muestra->>'semana')::int,
    p_muestra->>'hora_evaluacion',
    (p_muestra->>'fecha_cosecha')::date, (p_muestra->>'fecha_empaque')::date,
    (p_muestra->>'n_planta')::int, p_muestra->>'linea', p_muestra->>'turno',
    p_muestra->>'productor', p_muestra->>'cliente', p_muestra->>'destino',
    p_muestra->>'variedad', p_muestra->>'formato', p_muestra->>'tipo_empaque',
    p_muestra->>'calibre', p_muestra->>'embalaje_caja',
    p_muestra->>'embalaje_clamshell', p_muestra->>'intervalo_cosecha',
    p_muestra->>'dni_inspector', p_muestra->>'inspector', p_muestra->>'supervisor',
    p_muestra->>'dni_empacador', p_muestra->>'empacador',
    (p_muestra->>'peso_establecido')::numeric, p_muestra->>'medida_correctiva',
    p_muestra->>'observaciones', coalesce((p_muestra->>'created_at')::timestamptz, now()),
    p_muestra->>'created_by'
  )
  on conflict (id) do update set
    codigo = excluded.codigo, id_maestro = excluded.id_maestro, semana = excluded.semana,
    hora_evaluacion = excluded.hora_evaluacion,
    fecha_cosecha = excluded.fecha_cosecha, fecha_empaque = excluded.fecha_empaque,
    n_planta = excluded.n_planta, linea = excluded.linea, turno = excluded.turno,
    productor = excluded.productor, cliente = excluded.cliente, destino = excluded.destino,
    variedad = excluded.variedad, formato = excluded.formato, tipo_empaque = excluded.tipo_empaque,
    calibre = excluded.calibre, embalaje_caja = excluded.embalaje_caja,
    embalaje_clamshell = excluded.embalaje_clamshell,
    intervalo_cosecha = excluded.intervalo_cosecha, dni_inspector = excluded.dni_inspector,
    inspector = excluded.inspector, supervisor = excluded.supervisor,
    dni_empacador = excluded.dni_empacador, empacador = excluded.empacador,
    peso_establecido = excluded.peso_establecido, medida_correctiva = excluded.medida_correctiva,
    observaciones = excluded.observaciones;

  delete from public.clamshells c
  where c.muestra_id = v_id
    and c.id not in (
      select (elem->>'id')::uuid from jsonb_array_elements(p_clamshells) elem
    );

  insert into public.clamshells (
    id, muestra_id, n_clamshell, n_bayas_evaluadas, counts, nota, observacion
  )
  select
    (elem->>'id')::uuid, v_id, (elem->>'n_clamshell')::int,
    coalesce((elem->>'n_bayas_evaluadas')::int, 99), coalesce(elem->'counts', '{}'::jsonb),
    (elem->>'nota')::int, elem->>'observacion'
  from jsonb_array_elements(p_clamshells) elem
  on conflict (id) do update set
    n_clamshell = excluded.n_clamshell,
    n_bayas_evaluadas = excluded.n_bayas_evaluadas, counts = excluded.counts,
    nota = excluded.nota, observacion = excluded.observacion;

  select m.updated_at into v_current_updated_at from public.muestras m where m.id = v_id;
  return query select v_current_updated_at, false;
end;
$$;

grant execute on function public.upsert_muestra_full(jsonb, jsonb, timestamptz) to authenticated;

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
