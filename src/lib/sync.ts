/**
 * SINCRONIZACIÓN BIDIRECCIONAL con Supabase.
 *
 * - push(): sube todas las muestras `pending` con una única llamada atómica
 *   por muestra (RPC `upsert_muestra_full`, ver supabase/schema.sql) que
 *   escribe la muestra + sus clamshells en una sola transacción, y detecta
 *   si alguien más la editó en el servidor mientras tanto (conflicto).
 * - pull(): descarga muestras del servidor y las mezcla en IndexedDB.
 * - Los fallos de red (sin señal, timeout) se reintentan con backoff
 *   exponencial; los errores que sí llegaron a responder del servidor
 *   (RLS, conflicto) no se reintentan — se resuelven, no se repiten.
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

function muestraToRow(m: Muestra) {
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
    created_at: m.createdAt,
    updated_at: m.updatedAt,
    created_by: m.createdBy,
  };
}

function clamshellToRow(cs: Clamshell) {
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
  const pending = (await listMuestrasLocal()).filter((m) => m.sync === "pending");
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
    // No pisar cambios locales aún no sincronizados, ni un conflicto que el
    // usuario todavía no resolvió a mano.
    if (local && (local.sync === "pending" || local.sync === "conflict")) continue;

    await db.muestras.put(rowToMuestra(r, byMuestra.get(r.id) || []));
    merged++;
  }
  return merged;
}

/** Sincronización completa (push + pull). */
export async function fullSync(): Promise<{ pushed: number; pulled: number; failed: number; conflicts: number }> {
  const { ok, fail, conflict } = await pushPending();
  const pulled = await pullAll();
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
  await db.muestras.put(rowToMuestra(r, cls || []));
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
