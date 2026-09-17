/**
 * SINCRONIZACIÓN BIDIRECCIONAL con Supabase.
 *
 * - push(): sube todas las muestras `pending` (y también las que quedaron en
 *   `error` — ver más abajo) con una única llamada atómica por muestra (RPC
 *   `upsert_muestra_full`, ver supabase/schema.sql) que escribe la muestra +
 *   sus clamshells en una sola transacción, y detecta si alguien más la
 *   editó en el servidor mientras tanto (conflicto).
 * - pull(): descarga muestras del servidor y las mezcla en IndexedDB — NUNCA
 *   pisa una muestra local en `pending`, `error` ni `conflict` (ver el
 *   porqué, con el bug real que esto corrigió, en pullAll() más abajo).
 * - Reintentos: DENTRO de un solo intento de push, `withRetry()` solo
 *   reintenta fallos de RED (el fetch nunca llegó a responder) — un error
 *   que el servidor SÍ llegó a responder (RLS, violación de constraint) no
 *   se repite ahí, porque repetir la misma llamada no cambiaría ese
 *   resultado. A través de los CICLOS de sync (cada 60s), en cambio,
 *   pushPending() sí vuelve a intentar una muestra en `error` — a propósito:
 *   la causa puede ser transitoria (red) o puede resolverse sola con el
 *   tiempo (ej. una política RLS que se corrija en el servidor, como pasó de
 *   verdad — ver is_owner() en supabase/schema.sql), y como pullAll() ya
 *   protege a "error" del pisado, reintentar para siempre es más seguro que
 *   dejar de intentar (el peor costo de seguir reintentando es una llamada
 *   de más cada 60s; el de NO reintentar es una muestra que se queda
 *   trabada para siempre, sin forma de que se cure sola).
 * - Se ejecuta al recuperar conexión y a demanda desde la UI.
 */

import { supabase, isSupabaseConfigured } from "./supabase";
import { db, listMuestrasLocal } from "./db";
import type { Muestra, Clamshell } from "./types";

/**
 * Reintenta `fn` solo cuando lanza una excepción (fallo de red / timeout:
 * el fetch nunca llegó a responder). Si `fn` resuelve — aunque sea con un
 * error de aplicación como `{ error }` de supabase-js — no se reintenta:
 * el servidor sí respondió, y repetir la llamada no cambia ese resultado.
 */
async function withRetry<T>(fn: () => PromiseLike<T>, retries = 2, baseDelayMs = 800): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries) throw err;
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt));
    }
  }
}

// Exportadas (antes privadas): permite reusarlas tal cual desde un script
// de verificación standalone (fuera de la app) para probar el round-trip
// real Muestra -> fila -> RPC -> fila -> Muestra sin duplicar esta lógica
// a mano en el script. Sin cambio de comportamiento.
export function muestraToRow(m: Muestra) {
  return {
    id: m.id,
    codigo: m.codigo,
    id_maestro: m.idMaestro,
    semana: m.semana,
    hora_evaluacion: m.horaEvaluacion,
    fecha_cosecha: m.fechaCosecha,
    fecha_empaque: m.fechaEmpaque,
    planta_empaque: m.plantaEmpaque,
    linea: m.linea,
    turno: m.turno,
    productor: m.productor,
    cliente: m.cliente,
    destino: m.destino,
    variedad: m.variedad,
    formato: m.formato,
    tipo_empaque: m.tipoEmpaque,
    calibre: m.calibre,
    embalaje_caja: m.embalajeCaja,
    embalaje_clamshell: m.embalajeClamshell,
    intervalo_cosecha: m.intervaloCosecha,
    dni_inspector: m.dniInspector,
    inspector: m.inspector,
    supervisor: m.supervisor,
    dni_empacador: m.dniEmpacador,
    empacador: m.empacador,
    peso_establecido: m.pesoEstablecido,
    medida_correctiva: m.medidaCorrectiva,
    observaciones: m.observaciones,
    nota_manual: m.notaManual,
    created_at: m.createdAt,
    updated_at: m.updatedAt,
    created_by: m.createdBy,
  };
}

export function clamshellToRow(cs: Clamshell) {
  return {
    id: cs.id,
    muestra_id: cs.muestraId,
    n_clamshell: cs.nClamshell,
    n_bayas_evaluadas: cs.nBayasEvaluadas,
    counts: cs.counts,
    nota: cs.nota,
    observacion: cs.observacion,
  };
}

/** Reconstituye una Muestra local a partir de las filas planas de Supabase. */
export function rowToMuestra(r: any, clamshellRows: any[]): Muestra {
  return {
    id: r.id,
    codigo: r.codigo,
    idMaestro: r.id_maestro,
    semana: r.semana,
    horaEvaluacion: r.hora_evaluacion ?? "",
    fechaCosecha: r.fecha_cosecha,
    fechaEmpaque: r.fecha_empaque,
    plantaEmpaque: r.planta_empaque ?? "",
    linea: r.linea ?? "",
    turno: r.turno,
    productor: r.productor ?? "",
    cliente: r.cliente ?? "",
    destino: r.destino ?? "",
    variedad: r.variedad ?? "",
    formato: r.formato ?? "",
    tipoEmpaque: r.tipo_empaque ?? "",
    calibre: r.calibre ?? "",
    embalajeCaja: r.embalaje_caja ?? "",
    embalajeClamshell: r.embalaje_clamshell ?? "",
    intervaloCosecha: r.intervalo_cosecha ?? "",
    dniInspector: r.dni_inspector ?? "",
    inspector: r.inspector ?? "",
    supervisor: r.supervisor ?? "",
    dniEmpacador: r.dni_empacador ?? "",
    empacador: r.empacador ?? "",
    pesoEstablecido: r.peso_establecido,
    medidaCorrectiva: r.medida_correctiva ?? "",
    observaciones: r.observaciones ?? "",
    notaManual: r.nota_manual ?? null,
    // grupoId ("carpeta") es puramente local, no viaja a Supabase — arranca
    // en null acá; pullAll()/resolveConflictUseServer() lo restauran desde
    // el registro local existente cuando corresponde (ver esos dos lugares).
    grupoId: null,
    clamshells: clamshellRows
      .map((c: any) => ({
        id: c.id,
        muestraId: c.muestra_id,
        nClamshell: c.n_clamshell,
        nBayasEvaluadas: c.n_bayas_evaluadas,
        counts: c.counts || {},
        nota: c.nota,
        observacion: c.observacion ?? "",
      }))
      .sort((a: Clamshell, b: Clamshell) => a.nClamshell - b.nClamshell),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    createdBy: r.created_by ?? "",
    sync: "synced",
    baseUpdatedAt: r.updated_at,
  };
}

/** Sube una muestra + sus clamshells en una sola llamada atómica.
 *  `force = true` ignora el chequeo de conflicto (se usa al resolver uno a mano). */
async function pushOne(m: Muestra, force = false): Promise<"ok" | "conflict"> {
  const { data, error } = await withRetry(() =>
    supabase!.rpc("upsert_muestra_full", {
      p_muestra: muestraToRow(m),
      p_clamshells: m.clamshells.map(clamshellToRow),
      p_expected_updated_at: force ? null : m.baseUpdatedAt,
    })
  );
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (row?.is_conflict) {
    m.sync = "conflict";
    await db.muestras.put(m);
    return "conflict";
  }
  m.sync = "synced";
  m.baseUpdatedAt = row?.updated_at ?? m.baseUpdatedAt;
  // El servidor asigna el ID/código real recién en el primer sync exitoso
  // (ver upsert_muestra_full en supabase/schema.sql) — el que se generó
  // localmente al crear la muestra es solo un correlativo provisorio, y dos
  // dispositivos sin conexión entre sí pueden haber generado el mismo. Acá
  // se reemplaza por el definitivo; en syncs siguientes esto es un no-op
  // porque el servidor ya no lo vuelve a cambiar.
  if (row?.id_maestro != null) m.idMaestro = row.id_maestro;
  if (row?.codigo) m.codigo = row.codigo;
  await db.muestras.put(m);
  return "ok";
}

export async function pushPending(): Promise<{ ok: number; fail: number; conflict: number }> {
  if (!isSupabaseConfigured || !supabase) return { ok: 0, fail: 0, conflict: 0 };
  // También se reintentan las que quedaron en "error" (un push anterior
  // falló — red inestable, típico en planta) — antes SOLO se tomaban las
  // "pending", así que una que fallara UNA VEZ quedaba marcada "error" PARA
  // SIEMPRE: nunca se volvía a intentar subir, Y (bug relacionado, ver
  // pullAll() más abajo) quedaba desprotegida frente al próximo pull, que
  // la pisaba con la versión vieja del servidor — pareciendo que los datos
  // recién cargados "se borraban solos".
  const pending = (await listMuestrasLocal()).filter((m) => m.sync === "pending" || m.sync === "error");
  let ok = 0;
  let fail = 0;
  let conflict = 0;

  for (const m of pending) {
    try {
      const result = await pushOne(m);
      if (result === "conflict") conflict++;
      else ok++;
    } catch (err) {
      console.error("[sync] push error", m.codigo, err);
      m.sync = "error";
      await db.muestras.put(m);
      fail++;
    }
  }
  return { ok, fail, conflict };
}

export async function pullAll(): Promise<number> {
  if (!isSupabaseConfigured || !supabase) return 0;
  const { data: muestras, error } = await withRetry(() =>
    supabase!.from("muestras").select("*").order("updated_at", { ascending: false })
  );
  if (error || !muestras) return 0;

  const { data: clamshells } = await withRetry(() => supabase!.from("clamshells").select("*"));
  const byMuestra = new Map<string, any[]>();
  (clamshells || []).forEach((c: any) => {
    const arr = byMuestra.get(c.muestra_id) || [];
    arr.push(c);
    byMuestra.set(c.muestra_id, arr);
  });

  // ids que el usuario borró a propósito en ESTE dispositivo (ver
  // deleteMuestraLocal en lib/db.ts) — sin este chequeo, el sync automático
  // de cada 60s (ver Providers.tsx) las volvía a bajar y reponer solas a
  // los pocos segundos de "Limpiar registros" o de borrar una muestra ya
  // sincronizada, dando la falsa impresión de que el borrado no funcionaba.
  // Se carga una sola vez acá (no una consulta por fila) para no volver
  // lento el pull cuando hay muchas muestras.
  const borradas = new Set((await db.tombstones.toArray()).map((t) => t.id));

  let merged = 0;
  for (const r of muestras as any[]) {
    if (borradas.has(r.id)) continue;
    const local = await db.muestras.get(r.id);
    // No pisar cambios locales aún no sincronizados ("pending"), un
    // conflicto que el usuario todavía no resolvió a mano ("conflict"), NI
    // uno cuyo push falló ("error") — este último faltaba, y era un bug
    // real que perdía datos de verdad: pushPending() sube todo lo
    // "pending"/"error" y LUEGO, en el mismo fullSync(), se llama a este
    // pullAll(). Si el push de una muestra fallaba (red inestable — muy
    // común en planta) quedaba en "error", y al no estar excluida acá, EL
    // MISMO ciclo de sync la volvía a bajar del servidor con la versión
    // vieja (la del último push que SÍ había llegado, quizás con menos
    // clamshells o defectos en cero) y la pisaba — el inspector veía sus
    // datos recién cargados "resetearse solos" sin haber hecho nada raro.
    if (local && (local.sync === "pending" || local.sync === "conflict" || local.sync === "error")) continue;

    const nueva = rowToMuestra(r, byMuestra.get(r.id) || []);
    // grupoId (la "carpeta"/Grupo de especificaciones) es puramente local:
    // no viaja a Supabase (ver muestraToRow arriba), así que rowToMuestra()
    // siempre la deja en null. Sin este merge, cada sync automático (cada
    // 60s) pisaba el registro completo con la versión del servidor y
    // BORRABA la carpeta asignada a mano en este dispositivo, apenas la
    // muestra terminaba de sincronizar una vez. Se preserva la que ya
    // hubiera localmente.
    if (local?.grupoId) nueva.grupoId = local.grupoId;
    await db.muestras.put(nueva);
    merged++;
  }

  // Limpieza de borrados REALES (ver deleteMuestraFromServer() más abajo,
  // usada desde el Panel de Coordinador de Calidad): una muestra local que
  // ya estaba "synced" (confirmada con el servidor alguna vez) y que ya NO
  // aparece en la lista que acaba de bajar, fue borrada de verdad en el
  // servidor — se borra también en ESTE dispositivo, para que no quede
  // "fantasma" mostrándose para siempre. Solo se tocan las "synced": una
  // "pending"/"error"/"conflict" nunca se toca acá (podría ser una muestra
  // recién creada en este mismo dispositivo que todavía no llegó a subir
  // por primera vez, y por lo tanto es normal que no esté en esta lista).
  const idsDelServidor = new Set((muestras as any[]).map((r) => r.id));
  const locales = await listMuestrasLocal();
  for (const local of locales) {
    if (local.sync === "synced" && !idsDelServidor.has(local.id)) {
      await db.muestras.delete(local.id);
    }
  }

  return merged;
}

/**
 * Borra una muestra DEL SERVIDOR para siempre (y también de este
 * dispositivo) — a diferencia de deleteMuestraLocal() (lib/db.ts), que
 * solo la "esconde" de ESTE dispositivo sin tocar el servidor, dejándola
 * intacta para cualquier otro. Los clamshells se borran solos (ON DELETE
 * CASCADE, ver supabase/schema.sql). Usada desde el Panel de Coordinador
 * de Calidad ("Eliminar definitivamente") — las políticas RLS
 * (muestras_delete) ya exigen ser Jefatura o el propio creador, así que un
 * intento no autorizado directo contra Supabase se rechaza solo, no hace
 * falta repetir ese chequeo acá.
 */
export async function deleteMuestraFromServer(id: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Sin backend configurado.");
  const { error } = await withRetry(() => supabase!.from("muestras").delete().eq("id", id));
  if (error) throw error;
  await db.muestras.delete(id);
  await db.tombstones.put({ id, deletedAt: new Date().toISOString() });
}

/**
 * Sincroniza el catálogo LOCAL de empacadores (tipo "empacador" en
 * db.catalogos, usado por el autocompletado y por el cruce DNI→nombre) con
 * la tabla public.empacadores de Supabase — administrada por Jefatura desde
 * /dashboard/empacadores. A diferencia de pullAll()/pushPending() (que
 * mezclan sin borrar nada que no venga del servidor), esto REEMPLAZA por
 * completo la lista local de "empacador": el servidor pasa a ser la única
 * fuente de verdad para este catálogo, así que cualquier entrada local
 * vieja/de prueba que ya no esté ahí (o que se haya dado de baja) también
 * desaparece sola en cada ciclo — sin depender de comparar contra la lista
 * estática del Excel (ver el comentario grande en seedListaMaestra(), en
 * lib/db.ts, sobre por qué "empacador" dejó de limpiarse así cuando hay
 * backend configurado).
 *
 * Solo trae empacadores con `activo = true` — dar de baja a alguien (dejó
 * la empresa) hace que deje de sugerirse, pero ninguna muestra ya cargada
 * con su nombre se toca (ese campo es texto libre, copiado en el momento
 * de crear la muestra — no depende de que esta fila siga existiendo).
 *
 * Si el pedido falla (sin señal, error de red), NO borra nada localmente —
 * primero se confirma la lista nueva completa, recién ahí se reemplaza; se
 * reintenta solo en el próximo ciclo (cada 60s, ver Providers.tsx).
 */
export async function syncEmpacadoresFromServer(): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const { data, error } = await withRetry(() =>
    supabase!.from("empacadores").select("dni, nombre").eq("activo", true)
  );
  if (error || !data) return;

  const entries = data.map((e: { dni: string; nombre: string }) => ({
    tipo: "empacador",
    valor: e.nombre,
    extra: e.dni,
  }));
  await db.transaction("rw", db.catalogos, async () => {
    await db.catalogos.where("tipo").equals("empacador").delete();
    await db.catalogos.bulkPut(entries);
  });
}

/** Sincronización completa (push + pull + catálogo de empacadores). */
export async function fullSync(): Promise<{ pushed: number; pulled: number; failed: number; conflicts: number }> {
  const { ok, fail, conflict } = await pushPending();
  const pulled = await pullAll();
  await syncEmpacadoresFromServer();
  return { pushed: ok, pulled, failed: fail, conflicts: conflict };
}

/**
 * Resuelve un conflicto descartando los cambios locales: trae la versión
 * actual del servidor y la deja como la copia local (se pierde lo editado
 * en este dispositivo desde la última sincronización).
 */
export async function resolveConflictUseServer(id: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const { data: r, error } = await withRetry(() =>
    supabase!.from("muestras").select("*").eq("id", id).maybeSingle()
  );
  if (error || !r) throw error ?? new Error("La muestra ya no existe en el servidor");
  const { data: cls } = await withRetry(() =>
    supabase!.from("clamshells").select("*").eq("muestra_id", id)
  );
  const nueva = rowToMuestra(r, cls || []);
  // Mismo motivo que en pullAll(): grupoId es local, no viaja a Supabase —
  // se preserva la carpeta que ya tuviera esta muestra en este dispositivo.
  const local = await db.muestras.get(id);
  if (local?.grupoId) nueva.grupoId = local.grupoId;
  await db.muestras.put(nueva);
}

/**
 * Resuelve un conflicto conservando los cambios locales: re-sube esta
 * muestra ignorando lo que haya en el servidor (lo sobrescribe a propósito).
 */
export async function resolveConflictKeepLocal(id: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const m = await db.muestras.get(id);
  if (!m) return;
  await pushOne(m, /* force */ true);
}
