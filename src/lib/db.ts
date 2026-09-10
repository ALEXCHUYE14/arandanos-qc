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
import { LISTA_MAESTRA } from "./listaMaestra";

export interface CatalogoEntry {
  tipo: string; // 'inspector' | 'empacador' | 'supervisor' | 'cliente' | ...
  valor: string;
  extra?: string; // p.ej. DNI asociado
}

export interface SeqEntry {
  key: string; // 'muestra'
  value: number;
}

/**
 * Registro de "esto se borró a propósito en este dispositivo" — ver
 * deleteMuestraLocal() y su uso en sync.ts → pullAll(). Sin esto, una
 * muestra ya sincronizada que se borra localmente reaparecía sola en el
 * siguiente sync automático (corre cada 60s, ver Providers.tsx), porque
 * pullAll() no tenía forma de distinguir "nunca la bajé" de "la bajé y la
 * borré adrede" — para pullAll(), ambos casos se ven igual (no existe
 * localmente), así que la volvía a traer del servidor.
 */
export interface TombstoneEntry {
  id: string; // id de la muestra borrada
  deletedAt: string;
}

class ArandanosDB extends Dexie {
  muestras!: Table<Muestra, string>;
  catalogos!: Table<CatalogoEntry, [string, string]>;
  seq!: Table<SeqEntry, string>;
  tombstones!: Table<TombstoneEntry, string>;

  constructor() {
    super("arandanos_qc");
    this.version(1).stores({
      muestras: "id, codigo, sync, updatedAt, empacador, semana, createdBy",
      catalogos: "[tipo+valor], tipo",
      seq: "key",
    });
    // v2: agrega `tombstones` sin tocar las tablas existentes — migración de
    // Dexie no destructiva, los dispositivos que ya tenían datos los
    // conservan igual, solo se suma la tabla nueva (vacía) por encima.
    this.version(2).stores({
      tombstones: "id, deletedAt",
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

/**
 * Borra una muestra de ESTE dispositivo. Además de borrarla, deja un
 * "tombstone" con su id — así, si esta muestra ya estaba sincronizada con
 * el servidor, el próximo sync automático (cada 60s) no la vuelve a bajar y
 * reponer sola (ver pullAll() en lib/sync.ts). El registro en el servidor
 * NO se toca: sigue existiendo ahí para Jefatura/Coordinador de Calidad —
 * esto solo evita que reaparezca en la lista de ESTE dispositivo.
 */
export async function deleteMuestraLocal(id: string): Promise<void> {
  await db.muestras.delete(id);
  await db.tombstones.put({ id, deletedAt: new Date().toISOString() });
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
  add("linea", m.linea);
  add("intervalo_cosecha", m.intervaloCosecha);
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

/**
 * Siembra las listas desplegables de "Nueva muestra" con los valores reales
 * de la hoja "Lista Maestra" del Excel del cliente (lib/listaMaestra.ts).
 *
 * Sin esto, las listas de Cliente/Destino/Variedad/etc. arrancan VACÍAS en
 * cada dispositivo nuevo — el autocompletado solo aprendía de lo que un
 * inspector ya había tipeado antes en ESE celular puntual, así que un
 * dispositivo recién instalado no ofrecía ninguna opción real del cliente.
 *
 * Corre una vez en cada arranque de la app (ver Providers), igual que
 * fixInspectorNameTypo(). Es idempotente y no destructivo: usa `put` (no
 * `add`), así que si un inspector ya cargó a mano un valor que coincide
 * exactamente con uno de referencia, simplemente lo deja como está — nunca
 * borra ni pisa un valor que el usuario haya escrito distinto.
 */
export async function seedListaMaestra(): Promise<void> {
  if (!db) return;
  const entries: CatalogoEntry[] = [];
  const addMany = (tipo: string, valores: readonly (string | number)[]) => {
    const vistos = new Set<string>();
    for (const v of valores) {
      const valor = String(v).trim();
      if (!valor || vistos.has(valor)) continue;
      vistos.add(valor);
      entries.push({ tipo, valor });
    }
  };

  addMany("cliente", LISTA_MAESTRA.clientes);
  addMany("destino", LISTA_MAESTRA.destinos);
  addMany("formato", LISTA_MAESTRA.formatos);
  addMany("calibre", LISTA_MAESTRA.calibres);
  addMany("tipo_empaque", LISTA_MAESTRA.tiposEmpaque);
  addMany("embalaje_caja", LISTA_MAESTRA.embalajesCaja);
  addMany("embalaje_clamshell", LISTA_MAESTRA.etiquetasClamshell);
  addMany("variedad", LISTA_MAESTRA.variedades);
  addMany("productor", LISTA_MAESTRA.productores);
  addMany("linea", LISTA_MAESTRA.lineas);
  addMany("intervalo_cosecha", LISTA_MAESTRA.intervalosCosecha);
  addMany("planta_empaque", LISTA_MAESTRA.plantasEmpaque);

  // Inspectores y empacadores: van con su DNI real (columna "extra"), así el
  // autocompletado nombre→DNI y DNI→nombre funciona también con estos.
  for (const insp of LISTA_MAESTRA.inspectores) {
    entries.push({ tipo: "inspector", valor: insp.nombre.trim(), extra: insp.dni });
  }
  for (const emp of LISTA_MAESTRA.empacadores) {
    entries.push({ tipo: "empacador", valor: emp.nombre.trim(), extra: emp.dni });
  }

  await db.catalogos.bulkPut(entries);
  await limpiarClientesDuplicados();
  await limpiarEmpacadoresObsoletos();
}

/**
 * "OZBLU" y "ENGSHENG" se agregaron un momento como clientes nuevos a pedido
 * del usuario, pero resultaron ser el mismo cliente que "OZBLUE" y
 * "PENGSHENG" (ya en la lista) — el usuario lo confirmó. seedListaMaestra()
 * solo agrega, nunca borra, así que cualquier dispositivo que ya haya
 * sembrado esas dos entradas las conserva para siempre si no se borran acá
 * explícitamente. Igual que fixInspectorNameTypo(): corre en cada arranque,
 * no rompe nada si ya no queda nada que borrar.
 */
async function limpiarClientesDuplicados(): Promise<void> {
  const DUPLICADOS = ["OZBLU", "ENGSHENG"];
  for (const nombre of DUPLICADOS) {
    const entrada = await db.catalogos.get(["cliente", nombre]);
    if (entrada) await db.catalogos.delete(["cliente", nombre]);
  }
}

/**
 * Encontrado en auditoría: hasta el 08/09/2026, LISTA_MAESTRA.empacadores
 * era una lista de 36 nombres sin DNI (columnas incompletas de la hoja
 * "Lista Maestra" del primer Excel). Se reemplazó por 203 registros con DNI
 * reales de la hoja EMPACADORES del Excel de referencia — pero varios de
 * esos 36 nombres viejos son apellidos/nombres RECORTADOS o con errores de
 * tipeo del mismo empacador que ahora aparece completo (ej. "FARROÑAN
 * SANDOVAL MANUEL" vs "FARROÑAN SANDOVAL WILLIAN JOEL" / "...YORDY MANUEL";
 * "PECHE SANTIESTEBAN ROGGER" vs "PECHE SANTISTEBAN ROGGER", con distinta
 * ortografía). Como seedListaMaestra() solo agrega (nunca borra), cualquier
 * dispositivo que ya hubiera usado la app antes de ese cambio conserva esos
 * 36 nombres viejos SIN DNI como sugerencias, generando duplicados confusos
 * en el autocompletado de Empacador — y si un inspector elige por error la
 * versión vieja, pierde el autocompletado de DNI que si tiene la versión
 * nueva. Se borran acá (misma idea que limpiarClientesDuplicados de
 * arriba): esto solo limpia la SUGERENCIA cacheada, nunca toca muestras ya
 * guardadas con ese nombre. Los 6 nombres de esa lista vieja que sí
 * coinciden EXACTO con la nueva (y por lo tanto no generan duplicado) no
 * están acá: "ACOSTA SANCHEZ JOSE", "CHAPOÑAN ZAPATA MARIELA", "LLONTOP
 * PINGO LUCINDA", "MORI BANCES CECILIO", "SIESQUEN SANDOVAL ELIZABETH",
 * "SOPLAPUCO MOZO JUAN FRANCISCO".
 */
async function limpiarEmpacadoresObsoletos(): Promise<void> {
  const OBSOLETOS = [
    "ACOSTA CALLACNA MANUEL",
    "BANCES SANTIESTEBAN MELISSA",
    "CHAPOÑAN ZAPATA JESUS",
    "FARROÑAN SANDOVAL MANUEL",
    "LLONTOP PINGO VIOLETA",
    "LLONTOP SANTAMARÍA ESPERANZA",
    "LLONTOP SANTAMARÍA JULIA",
    "MACALOPU SERREPE KASANDRA",
    "MACALOPU SERREPE ROMARIO",
    "MAZA IZQUIERDO RUTH",
    "MONTALVÁN GÓMEZ ANDY",
    "NIMA TORRES JOSE",
    "OLIVA NIMA TOMAS",
    "PECHE SANTIESTEBAN GEAN MARCO",
    "PECHE SANTIESTEBAN ROGGER",
    "SANDOVAL BANCES ALEXIS",
    "SANDOVAL FARROÑAN DIANA",
    "SANDOVAL FARROÑAN HERBER",
    "SANTAMARÍA BALDERA MARTINA",
    "SANTAMARÍA SOPLAPUCO JUANA",
    "SANTIESTEBAN LLONTOP DILBER",
    "SOPLAPUCO LLONTOP MIGUEL",
    "SOPLOPUCO SANTAMARÍA MARTIN",
    "SUCLUPE SANDOVAL CESAR",
    "TANTALEAN ACOSTA DAVID",
    "TINEO CUEVA LUZ",
    "TIQUILLAHUANCA SÁNCHEZ SAMUEL",
    "VALDERA SANTIESTEBAN FRANK",
    "ZAPATA LLONTOP ANDERSON",
    "ZEÑA  SANTIESTEBAN JOSÉ", // doble espacio intencional: así quedó guardado
  ];
  for (const nombre of OBSOLETOS) {
    const entrada = await db.catalogos.get(["empacador", nombre]);
    if (entrada) await db.catalogos.delete(["empacador", nombre]);
  }
}
