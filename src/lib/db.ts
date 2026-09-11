/**
 * PERSISTENCIA LOCAL (IndexedDB vía Dexie) — base del modo offline-first.
 *
 * Las muestras se guardan completas (con sus clamshells embebidos) en la tabla
 * `muestras`. Cada cambio queda marcado con `sync: 'pending'` hasta que el
 * sincronizador lo sube a Supabase. Las listas de autocompletado (inspectores,
 * empacadores, supervisores, clientes...) se cachean en `catalogos`.
 */

import Dexie, { type Table } from "dexie";
import type { Muestra, GrupoEntry } from "./types";
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
  grupos!: Table<GrupoEntry, string>;

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
    // v3: agrega `grupos` ("carpetas" de especificaciones) — misma migración
    // no destructiva, solo suma la tabla nueva (vacía) por encima.
    this.version(3).stores({
      grupos: "id, createdBy, createdAt",
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
  // Ya NO se cachea acá el catálogo de sugerencias (ver recordarCatalogoValor
  // más abajo, y el porqué en su comentario) — esto corre en CADA autoguardado
  // (varias veces por muestra, mientras el inspector sigue escribiendo en
  // cualquier campo), así que guardaba como "sugerencia para siempre"
  // cualquier texto a medio tipear o de prueba, no solo lo que quedaba
  // confirmado.
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

/**
 * "Grupo de especificaciones" (carpeta) — ver GrupoEntry en lib/types.ts.
 * Vive SOLO en este dispositivo (como todo lo demás en db.ts): no se
 * sincroniza a Supabase, es puramente una ayuda de organización local para
 * no repetir tipeo. Las Especificaciones de cada muestra igual se copian
 * completas a la muestra en sí (ver createMuestra en hooks/useMuestras.ts),
 * así que el reporte/export/cálculo de una muestra nunca depende de que su
 * grupo siga existiendo.
 */
export async function crearGrupoLocal(especificaciones: GrupoEntry["especificaciones"], createdBy: string): Promise<GrupoEntry> {
  const nombre =
    [especificaciones.cliente, especificaciones.destino, especificaciones.variedad, especificaciones.formato]
      .filter((v) => v && v.trim())
      .join(" · ") || "Grupo sin especificar";
  const grupo: GrupoEntry = {
    id: crypto.randomUUID(),
    nombre,
    especificaciones,
    createdAt: new Date().toISOString(),
    createdBy,
  };
  await db.grupos.put(grupo);
  return grupo;
}

export async function listGruposLocal(): Promise<GrupoEntry[]> {
  const all = await db.grupos.toArray();
  return all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getGrupoLocal(id: string): Promise<GrupoEntry | undefined> {
  return db.grupos.get(id);
}

/**
 * Elimina un Grupo de especificaciones (carpeta) de ESTE dispositivo. Solo
 * borra el grupo en sí, nunca las muestras que ya se hayan creado dentro de
 * él: cada muestra guarda su propia copia completa de las Especificaciones
 * (ver createMuestra en hooks/useMuestras.ts), así que no depende de que el
 * grupo siga existiendo — sus reportes/cálculos no se ven afectados. Si
 * alguna muestra vieja todavía apunta a este grupoId, simplemente deja de
 * poder "verse" desde una carpeta (getGrupoLocal devuelve undefined), lo
 * cual ya está contemplado en /inspector/grupo/[id]/page.tsx.
 */
export async function eliminarGrupoLocal(id: string): Promise<void> {
  await db.grupos.delete(id);
}

/**
 * Refresca las especificaciones guardadas de un grupo con las de una
 * muestra recién editada — así, si el inspector corrige a mano un campo de
 * especificación DENTRO de una muestra ya asignada a un grupo, esa
 * corrección también queda para la PRÓXIMA muestra que se cree en ese
 * mismo grupo (ver updateMuestra en hooks/useMuestras.ts). No rompe nada si
 * el grupo ya no existe (pudo borrarse a mano, aunque hoy no hay UI para
 * eso): sencillamente no hace nada.
 */
export async function actualizarEspecificacionesGrupo(
  grupoId: string,
  especificaciones: GrupoEntry["especificaciones"]
): Promise<void> {
  const grupo = await db.grupos.get(grupoId);
  if (!grupo) return;
  await db.grupos.put({ ...grupo, especificaciones });
}

/**
 * Recuerda UN valor puntual como sugerencia futura del autocompletado —
 * reemplaza a la vieja cacheCatalogosFromMuestra(), que guardaba TODOS los
 * campos de la muestra en CADA autoguardado (varias veces por muestra),
 * sin importar si el inspector ya había terminado de escribir ese campo o
 * seguía a medio tipear/probando. Eso hacía que texto de prueba o errores de
 * tipeo ("S", "dxfcece") quedaran guardados como sugerencia para siempre.
 *
 * Ahora cada campo de Autocomplete (ver components/inspector/Autocomplete.tsx)
 * llama a esto SOLO al perder el foco / cerrarse (el inspector ya "terminó"
 * con ese campo), no en cada autoguardado — así solo se recuerda lo que
 * quedó puesto de verdad. Se descarta un valor de un solo carácter (ej. "S"
 * tipeado sin querer): un valor real de catálogo nunca es tan corto.
 */
export async function recordarCatalogoValor(tipo: string, valor: string, extra?: string): Promise<void> {
  if (!db) return;
  const limpio = (valor || "").trim();
  if (limpio.length < 2) return;
  await db.catalogos.put({ tipo, valor: limpio, extra: extra?.trim() || undefined });
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

  // Limpieza general de los catálogos "cerrados" (con lista oficial COMPLETA
  // desde el Excel de referencia — a diferencia de "cliente"/"supervisor",
  // que sí admiten sumar valores nuevos legítimos con el tiempo y por eso NO
  // se tocan acá): borra cualquier sugerencia que no esté en la lista
  // oficial — texto de prueba, errores de tipeo, o entradas de una versión
  // vieja de la lista (ver el caso real de "empacador" más abajo). No toca
  // ninguna muestra ya guardada, solo la sugerencia cacheada.
  await limpiarCatalogoNoOficial("destino", LISTA_MAESTRA.destinos);
  await limpiarCatalogoNoOficial("formato", LISTA_MAESTRA.formatos);
  await limpiarCatalogoNoOficial("calibre", LISTA_MAESTRA.calibres);
  await limpiarCatalogoNoOficial("tipo_empaque", LISTA_MAESTRA.tiposEmpaque);
  await limpiarCatalogoNoOficial("embalaje_caja", LISTA_MAESTRA.embalajesCaja);
  await limpiarCatalogoNoOficial("embalaje_clamshell", LISTA_MAESTRA.etiquetasClamshell);
  await limpiarCatalogoNoOficial("variedad", LISTA_MAESTRA.variedades);
  await limpiarCatalogoNoOficial("productor", LISTA_MAESTRA.productores);
  await limpiarCatalogoNoOficial("linea", LISTA_MAESTRA.lineas.map(String));
  await limpiarCatalogoNoOficial("intervalo_cosecha", LISTA_MAESTRA.intervalosCosecha.map(String));
  await limpiarCatalogoNoOficial("planta_empaque", LISTA_MAESTRA.plantasEmpaque);
  await limpiarCatalogoNoOficial(
    "inspector",
    LISTA_MAESTRA.inspectores.map((i) => i.nombre)
  );
  await limpiarCatalogoNoOficial(
    "empacador",
    LISTA_MAESTRA.empacadores.map((e) => e.nombre)
  );
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
 * Borra, de un catálogo "cerrado" (ver seedListaMaestra), cualquier
 * sugerencia que no esté en su lista oficial de valores — texto de prueba,
 * errores de tipeo, o entradas de una versión vieja de la lista (ej. hasta
 * el 08/09/2026 "empacador" era una lista de 36 nombres sin DNI, recortados
 * o con errores de tipeo frente a los 203 nombres completos que reemplazaron
 * esa lista — "FARROÑAN SANDOVAL MANUEL" vs "FARROÑAN SANDOVAL WILLIAN
 * JOEL"/"...YORDY MANUEL"; como seedListaMaestra() solo agrega, nunca borra,
 * esos 36 nombres viejos quedaban para siempre como duplicados confusos en
 * cualquier dispositivo que ya hubiera usado la app antes de ese cambio).
 * Solo limpia la SUGERENCIA cacheada; nunca toca una muestra ya guardada.
 */
async function limpiarCatalogoNoOficial(tipo: string, oficiales: readonly string[]): Promise<void> {
  const permitidos = new Set(oficiales.map((v) => v.trim()));
  const existentes = await db.catalogos.where("tipo").equals(tipo).toArray();
  for (const entrada of existentes) {
    if (!permitidos.has(entrada.valor)) {
      await db.catalogos.delete([tipo, entrada.valor]);
    }
  }
}
