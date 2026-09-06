/**
 * PERSISTENCIA LOCAL (IndexedDB vía Dexie) — base del modo offline-first.
 *
 * Las muestras se guardan completas (con sus clamshells embebidos) en la tabla
 * `muestras`. Cada cambio queda marcado con `sync: 'pending'` hasta que el
 * sincronizador lo sube a Supabase. Las listas de autocompletado (inspectores,
 * empacadores, supervisores, clientes...) se cachean en `catalogos`.
 */

import Dexie, { type Table } from "dexie";
import type { Muestra } from "./types";

export interface CatalogoEntry {
  tipo: string; // 'inspector' | 'empacador' | 'supervisor' | 'cliente' | ...
  valor: string;
  extra?: string; // p.ej. DNI asociado
}

export interface SeqEntry {
  key: string; // 'muestra'
  value: number;
}

class ArandanosDB extends Dexie {
  muestras!: Table<Muestra, string>;
  catalogos!: Table<CatalogoEntry, [string, string]>;
  seq!: Table<SeqEntry, string>;

  constructor() {
    super("arandanos_qc");
    this.version(1).stores({
      muestras: "id, codigo, sync, updatedAt, empacador, semana, createdBy",
      catalogos: "[tipo+valor], tipo",
      seq: "key",
    });
  }
}

export const db = typeof window !== "undefined" ? new ArandanosDB() : (null as unknown as ArandanosDB);

/** Correlativo local para el código ME-XXXXX (persistente en IndexedDB). */
export async function nextSeq(key = "muestra"): Promise<number> {
  return db.transaction("rw", db.seq, async () => {
    const cur = await db.seq.get(key);
    const value = (cur?.value ?? 10000) + 1;
    await db.seq.put({ key, value });
    return value;
  });
}

/** Guarda/actualiza una muestra localmente y la marca como pendiente de sync. */
export async function saveMuestraLocal(m: Muestra): Promise<void> {
  m.updatedAt = new Date().toISOString();
  m.sync = "pending";
  await db.muestras.put(m);
  await cacheCatalogosFromMuestra(m);
}

export async function deleteMuestraLocal(id: string): Promise<void> {
  await db.muestras.delete(id);
}

export async function getMuestraLocal(id: string): Promise<Muestra | undefined> {
  return db.muestras.get(id);
}

export async function listMuestrasLocal(): Promise<Muestra[]> {
  const all = await db.muestras.toArray();
  return all.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

/** Registra los valores usados para alimentar el autocompletado. */
async function cacheCatalogosFromMuestra(m: Muestra) {
  const entries: CatalogoEntry[] = [];
  const add = (tipo: string, valor?: string, extra?: string) => {
    if (valor && valor.trim()) entries.push({ tipo, valor: valor.trim(), extra });
  };
  add("inspector", m.inspector, m.dniInspector);
  add("empacador", m.empacador, m.dniEmpacador);
  add("supervisor", m.supervisor);
  add("cliente", m.cliente);
  add("productor", m.productor);
  add("destino", m.destino);
  add("variedad", m.variedad);
  add("formato", m.formato);
  add("calibre", m.calibre);
  add("embalaje_caja", m.embalajeCaja);
  add("embalaje_clamshell", m.embalajeClamshell);
  if (entries.length) await db.catalogos.bulkPut(entries);
}

export async function getCatalogo(tipo: string): Promise<CatalogoEntry[]> {
  return db.catalogos.where("tipo").equals(tipo).toArray();
}
