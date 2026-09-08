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
  add("tipo_empaque", m.tipoEmpaque);
  if (entries.length) await db.catalogos.bulkPut(entries);
}

export async function getCatalogo(tipo: string): Promise<CatalogoEntry[]> {
  return db.catalogos.where("tipo").equals(tipo).toArray();
}

/**
 * Busca en el catálogo (inspector/empacador) una entrada cuyo `extra` (el DNI
 * guardado junto al nombre) coincida con el DNI tipeado. Permite autocompletar
 * el nombre a partir del DNI, no solo el DNI a partir del nombre. Si no hay
 * ninguna coincidencia (personal nuevo, todavía no registrado), devuelve
 * `undefined` sin error — el campo queda en blanco para completarse después.
 */
export async function getCatalogoByExtra(tipo: string, extra: string): Promise<CatalogoEntry | undefined> {
  if (!extra || !extra.trim()) return undefined;
  const lista = await db.catalogos.where("tipo").equals(tipo).toArray();
  return lista.find((c) => c.extra === extra.trim());
}

/**
 * Recuerda el N° de bayas evaluadas típico de un empacador (la cantidad casi
 * siempre se repite dentro del mismo lote/empacador). Se guarda en el mismo
 * catálogo, con tipo "bayas_evaluadas" y el nombre del empacador como valor.
 */
export async function setBayasEvaluadasDefault(empacador: string, bayas: number): Promise<void> {
  if (!empacador || !empacador.trim() || !bayas) return;
  await db.catalogos.put({ tipo: "bayas_evaluadas", valor: empacador.trim(), extra: String(bayas) });
}

export async function getBayasEvaluadasDefault(empacador: string): Promise<number | undefined> {
  if (!empacador || !empacador.trim()) return undefined;
  const entry = await db.catalogos.get(["bayas_evaluadas", empacador.trim()]);
  const n = entry?.extra ? parseInt(entry.extra, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Corrección puntual: el nombre de la inspectora se guardó mal escrito
 * ("Betzy" en vez de "Betsy") antes de que se detectara el error. Ese valor
 * vive en IndexedDB de cada dispositivo donde se haya cargado una muestra
 * con ese nombre — no es algo que se pueda arreglar por SQL en el servidor,
 * porque cada navegador tiene su propia copia local. Esta función corre una
 * vez en cada arranque de la app (ver Providers) y corrige, en ESTE
 * dispositivo, tanto las muestras ya guardadas como la sugerencia cacheada
 * del autocompletado. Es idempotente: si no queda ningún registro con el
 * nombre viejo, no hace nada — es seguro que corra en cada carga de la app,
 * en todos los dispositivos, para siempre.
 */
export async function fixInspectorNameTypo(): Promise<void> {
  if (!db) return;
  const OLD_NAME = "Betzy Crisanto Valdiviezo";
  const NEW_NAME = "Betsy Crisanto Valdiviezo";

  const todas = await db.muestras.toArray();
  for (const m of todas) {
    if (m.inspector === OLD_NAME) {
      m.inspector = NEW_NAME;
      m.sync = "pending"; // para que la corrección también suba al servidor
      await db.muestras.put(m);
    }
  }

  const entradaVieja = await db.catalogos.get(["inspector", OLD_NAME]);
  if (entradaVieja) {
    await db.catalogos.delete(["inspector", OLD_NAME]);
    await db.catalogos.put({ ...entradaVieja, valor: NEW_NAME });
  }
}
