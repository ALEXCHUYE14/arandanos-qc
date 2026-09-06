/**
 * SINCRONIZACIÓN BIDIRECCIONAL con Supabase.
 *
 * - push(): sube todas las muestras `pending` (upsert de muestra + clamshells).
 * - pull(): descarga muestras del servidor y las mezcla en IndexedDB.
 * - Se ejecuta al recuperar conexión y a demanda desde la UI.
 *
 * El esquema en Supabase (ver supabase/schema.sql) usa dos tablas: `muestras`
 * y `clamshells`. Aquí se aplana/reconstituye el modelo embebido local.
 */

import { supabase, isSupabaseConfigured } from "./supabase";
import { db, listMuestrasLocal } from "./db";
import type { Muestra, Clamshell } from "./types";

function muestraToRow(m: Muestra) {
  return {
    id: m.id,
    codigo: m.codigo,
    id_maestro: m.idMaestro,
    semana: m.semana,
    fecha_cosecha: m.fechaCosecha,
    fecha_empaque: m.fechaEmpaque,
    n_planta: m.nPlanta,
    linea: m.linea,
    turno: m.turno,
    productor: m.productor,
    cliente: m.cliente,
    destino: m.destino,
    formato: m.formato,
    calibre: m.calibre,
    embalaje_caja: m.embalajeCaja,
    embalaje_clamshell: m.embalajeClamshell,
    variedad: m.variedad,
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
    peso: cs.peso,
    n_bayas_evaluadas: cs.nBayasEvaluadas,
    counts: cs.counts,
    nota: cs.nota,
    peso_correcto: cs.pesoCorrecto,
    trazabilidad_conforme: cs.trazabilidadConforme,
    calibre_correcto: cs.calibreCorrecto,
    observacion: cs.observacion,
  };
}

export async function pushPending(): Promise<{ ok: number; fail: number }> {
  if (!isSupabaseConfigured || !supabase) return { ok: 0, fail: 0 };
  const pending = (await listMuestrasLocal()).filter((m) => m.sync === "pending");
  let ok = 0;
  let fail = 0;

  for (const m of pending) {
    try {
      const { error: e1 } = await supabase.from("muestras").upsert(muestraToRow(m));
      if (e1) throw e1;

      // Reemplaza los clamshells del servidor por los locales.
      await supabase.from("clamshells").delete().eq("muestra_id", m.id);
      const rows = m.clamshells.map(clamshellToRow);
      if (rows.length) {
        const { error: e2 } = await supabase.from("clamshells").insert(rows);
        if (e2) throw e2;
      }

      m.sync = "synced";
      await db.muestras.put(m);
      ok++;
    } catch (err) {
      console.error("[sync] push error", m.codigo, err);
      m.sync = "error";
      await db.muestras.put(m);
      fail++;
    }
  }
  return { ok, fail };
}

export async function pullAll(): Promise<number> {
  if (!isSupabaseConfigured || !supabase) return 0;
  const { data: muestras, error } = await supabase
    .from("muestras")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error || !muestras) return 0;

  const { data: clamshells } = await supabase.from("clamshells").select("*");
  const byMuestra = new Map<string, any[]>();
  (clamshells || []).forEach((c: any) => {
    const arr = byMuestra.get(c.muestra_id) || [];
    arr.push(c);
    byMuestra.set(c.muestra_id, arr);
  });

  let merged = 0;
  for (const r of muestras as any[]) {
    const local = await db.muestras.get(r.id);
    // No pisar cambios locales aún no sincronizados.
    if (local && local.sync === "pending") continue;

    const m: Muestra = {
      id: r.id,
      codigo: r.codigo,
      idMaestro: r.id_maestro,
      semana: r.semana,
      fechaCosecha: r.fecha_cosecha,
      fechaEmpaque: r.fecha_empaque,
      nPlanta: r.n_planta,
      linea: r.linea ?? "",
      turno: r.turno,
      productor: r.productor ?? "",
      cliente: r.cliente ?? "",
      destino: r.destino ?? "",
      formato: r.formato ?? "",
      calibre: r.calibre ?? "",
      embalajeCaja: r.embalaje_caja ?? "",
      embalajeClamshell: r.embalaje_clamshell ?? "",
      variedad: r.variedad ?? "",
      intervaloCosecha: r.intervalo_cosecha ?? "",
      dniInspector: r.dni_inspector ?? "",
      inspector: r.inspector ?? "",
      supervisor: r.supervisor ?? "",
      dniEmpacador: r.dni_empacador ?? "",
      empacador: r.empacador ?? "",
      pesoEstablecido: r.peso_establecido,
      medidaCorrectiva: r.medida_correctiva ?? "",
      observaciones: r.observaciones ?? "",
      clamshells: (byMuestra.get(r.id) || [])
        .map((c: any) => ({
          id: c.id,
          muestraId: c.muestra_id,
          nClamshell: c.n_clamshell,
          peso: c.peso,
          nBayasEvaluadas: c.n_bayas_evaluadas,
          counts: c.counts || {},
          nota: c.nota,
          pesoCorrecto: c.peso_correcto,
          trazabilidadConforme: c.trazabilidad_conforme,
          calibreCorrecto: c.calibre_correcto,
          observacion: c.observacion ?? "",
        }))
        .sort((a: Clamshell, b: Clamshell) => a.nClamshell - b.nClamshell),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      createdBy: r.created_by ?? "",
      sync: "synced",
    };
    await db.muestras.put(m);
    merged++;
  }
  return merged;
}

/** Sincronización completa (push + pull). */
export async function fullSync(): Promise<{ pushed: number; pulled: number; failed: number }> {
  const { ok, fail } = await pushPending();
  const pulled = await pullAll();
  return { pushed: ok, pulled, failed: fail };
}
