/**
 * MAPA DE LAS 124 COLUMNAS DEL EXCEL MAESTRO (hoja "Base de Datos").
 * ------------------------------------------------------------------
 * El orden aquí es EXACTO al del archivo BH-F-CCA-006. Es lo que garantiza
 * que "Copiar fila para Excel Maestro" pegue con Ctrl+V sin descuadrar ni
 * una sola celda ni tocar los encabezados existentes.
 *
 * Cada fila del Excel = un clamshell. Los campos de cabecera se repiten en
 * cada fila del mismo lote; ESTÁNDAR /EMPACADOR solo se llena en el primer
 * clamshell de la muestra (igual que la fórmula original).
 */

import { DEFECTS } from "./defects";
import { computeMuestra, computeClamshell } from "./calc";
import type { Clamshell, Muestra } from "./types";

/** Encabezados literales de las 124 columnas, en orden (col 1 → col 124). */
export const HEADERS_124: string[] = [
  "ID",
  "SEMANA",
  "FECHA DE COSECHA",
  "FECHA DE EMPAQUE",
  "N° PLANTA DE EMPAQUE",
  "TURNO DE EMPAQUE",
  "PRODUCTOR",
  "CLIENTE",
  "DESTINO",
  "FORMATO",
  "CALIBRE",
  "EMBALAJE CAJA",
  "EMBALAJE CLAMSHELL",
  "VARIEDAD",
  "INTERVALO DE COSECHA",
  "DNI\nINSPECTOR CALIDAD",
  "APELLIDOS Y NOMBRE\nINSPECTOR CALIDAD",
  "SUPERVISOR DE PRODUCCIÓN",
  "DNI EMPACADOR",
  "APELLIDOS Y NOMBRE\nEMPACADOR",
  "N° BAYAS EVALUADAS",
  "N° DE CLAMSHELL",
  "NOTA",
  "ESTANDAR DE CALIDAD /CLAMSHELL",
  "ESTANDAR DE CALIDAD /EMPACADOR",
  "MEDIDA CORRECTIVA APLICADA",
  // Conteos de defectos (27-71)
  "DESGARRO LEVE SECO",
  "PRESENCIA DE COROLA",
  "PRESENCIA DE RESTO FLORAL VERDE",
  "PRESENCIA DE PEDÚNCULO",
  "POCA PRESENCIA DE BLOOM",
  "ROJO GRADO 1",
  "ARO PEDICELAR VERDE LEVE",
  "DAÑO DE TRIPS LEVE",
  "INSERCIÓN DE PEDÚNCULO LEVE",
  "POLVO LEVE",
  "DEFORME",
  "CERA DE ABEJA",
  "DESHIDRATADO LEVE",
  "DESHIDRATADO EXTREMO",
  "DESHIDRATADO INMADURO",
  "DESGARRO LEVE MOJADO",
  "PULPA EXPUESTA",
  "PARTIDOS/RAJADOS",
  "INSERCIÓN DE PEDÚNCULO EXTREMO",
  "EXUDADOS",
  "APLASTADOS",
  "DESGARRO GRADO 2 A MÁS",
  "BLANDO",
  "COLAPSADO",
  "PICADO DE AVE",
  "PICADO DE AVE CON PUDRICIÓN",
  "PODRIDO",
  "HONGO",
  "FUMAGINA",
  "PRESENCIA DE LARVA",
  "VESTIGIOS",
  "CHANCHITO BLANCO",
  "EXCRETA DE AVE",
  "PICADO DE INSECTOS",
  "ROJO GRADO 2 A MÁS",
  "IMMADURO VERDE",
  "DESORDEN POR MADURACIÓN",
  "POLVO EXTREMO",
  "ARO PEDICELAR VERDE EXTREMO",
  "DAÑO DE TRIPS EXTREMO",
  "DAÑO MECÁNICO",
  "MANCHA DE APLICACIÓN",
  "CERA DE ABEJA EXTREMO",
  "SIN BLOOM",
  "BAJO CALIBRE <10 mm",
  "OBSERVACIONES",
  // Porcentajes de defectos (73-115)
  "DESGARRO LEVE SECO (%)",
  "PRESENCIA DE COROLA (%)",
  "PRESENCIA DE RESTO FLORAL VERDE (%)",
  "PRESENCIA DE PEDÚNCULO (%)",
  "POCA PRESENCIA DE BLOOM (%)",
  "ROJO GRADO (%)",
  "ARO PEDICELAR VERDE LEVE (%)",
  "DAÑO DE TRIPS LEVE (%)",
  "INSERCIÓN DE PEDÚNCULO LEVE (%)",
  "POLVO LEVE (%)",
  "DEFORME (%)",
  "CERA DE ABEJA (%)",
  "DESHIDRATADO LEVE (%)",
  "DESHIDRATADO EXTREMO (%)",
  "DESHIDRATADO INMADURO (%)",
  "DESGARRO LEVE MOJADO (%)",
  "PULPA EXPUESTA (%)",
  "PARTIDOS/RAJADOS (%)",
  "INSERCIÓN DE PEDÚNCULO EXTREMO (%)",
  "EXUDADOS (%)",
  "APLASTADOS (%)",
  "DESGARRO GRADO 2 A MÁS (%)",
  "BLANDO (%)",
  "COLAPSADO (%)",
  "PICADO DE AVE (%)",
  "PICADO DE AVE CON PUDRICIÓN (%)",
  "PODRIDO (%)",
  "HONGO (%)",
  "FUMAGINA (%)",
  "PRESENCIA DE LARVA (%)",
  "VESTIGIOS (%)",
  "CHANCHITO BLANCO (%)",
  "EXCRETA DE AVES (%)",
  "PICADO DE INSECTOS (%)",
  "ROJO GRADO 2 A MÁS (%)",
  "DESORDEN POR MADURACIÓN (%)",
  "POLVO EXTREMO (%)",
  "ARO PEDICELAR VERDE EXTREMO (%)",
  "DAÑO DE TRIPS EXTREMO (%)",
  "DAÑO MECÁNICO (%)",
  "MANCHA DE APLICACIÓN (%)",
  "SIN BLOOM (%)",
  "BAJO CALIBRE <10 mm (%)",
  // Rollups de categoría (116-124)
  "PUDRICION/HONGO",
  "EXUDACION",
  "BLANDO ",
  "DESHIDRATADO",
  "RESIDUOS DE COSECHA",
  "DEFECTOS DE APARIENCIA",
  "OTROS",
  "TAMANO",
  "INSECTOS",
];

/** Orden de los rollups tal como aparecen en las columnas 116-124. */
const ROLLUP_COLS: string[] = [
  "pudricion_hongo",
  "exudacion",
  "blando",
  "deshidratado",
  "residuos_cosecha",
  "defectos_apariencia",
  "otros",
  "tamano",
  "insectos",
];

/** Defecto por columna de conteo y por columna de porcentaje. */
const DEFECT_BY_COUNT_COL = new Map(DEFECTS.map((d) => [d.countCol, d]));
const DEFECT_BY_PCT_COL = new Map(
  DEFECTS.filter((d) => d.pctCol != null).map((d) => [d.pctCol as number, d])
);

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

const s = (v: unknown): string => (v == null ? "" : String(v));

/**
 * Construye el arreglo de 124 valores para UNA fila (un clamshell), en el
 * orden exacto del maestro. Devuelve strings listos para pegar / exportar.
 *
 * @param esPrimerClamshell  controla si se emite ESTÁNDAR /EMPACADOR (col 25).
 */
export function buildRow124(
  m: Muestra,
  cs: Clamshell,
  esPrimerClamshell: boolean
): string[] {
  const mr = computeMuestra(m);
  const cr = computeClamshell(cs);

  const row: string[] = new Array(124).fill("");

  // Cabecera (1-26)
  row[0] = s(m.idMaestro);
  row[1] = s(m.semana);
  row[2] = fmtDate(m.fechaCosecha);
  row[3] = fmtDate(m.fechaEmpaque);
  row[4] = s(m.nPlanta);
  row[5] = s(m.turno);
  row[6] = s(m.productor);
  row[7] = s(m.cliente);
  row[8] = s(m.destino);
  row[9] = s(m.formato);
  row[10] = s(m.calibre);
  row[11] = s(m.embalajeCaja);
  row[12] = s(m.embalajeClamshell);
  row[13] = s(m.variedad);
  row[14] = s(m.intervaloCosecha);
  row[15] = s(m.dniInspector);
  row[16] = s(m.inspector);
  row[17] = s(m.supervisor);
  row[18] = s(m.dniEmpacador);
  row[19] = s(m.empacador);
  row[20] = s(cs.nBayasEvaluadas);
  row[21] = s(cs.nClamshell);
  row[22] = s(cr.nota);
  row[23] = cr.estandar;
  row[24] = esPrimerClamshell ? mr.estandarEmpacador : "";
  row[25] = s(m.medidaCorrectiva);

  // Conteos (27-71) y OBSERVACIONES (72)
  for (let col = 27; col <= 71; col++) {
    const d = DEFECT_BY_COUNT_COL.get(col);
    if (d) row[col - 1] = s(cs.counts[d.key] || 0);
  }
  row[71] = s(cs.observacion); // col 72

  // Porcentajes (73-115) — como fracción (Excel los muestra con formato %)
  for (let col = 73; col <= 115; col++) {
    const d = DEFECT_BY_PCT_COL.get(col);
    if (d) row[col - 1] = cr.defectPct[d.key] ? cr.defectPct[d.key].toFixed(6) : "0";
  }

  // Rollups (116-124)
  for (let i = 0; i < ROLLUP_COLS.length; i++) {
    const pct = cr.rollupPct[ROLLUP_COLS[i]] || 0;
    row[115 + i] = pct ? pct.toFixed(6) : "0";
  }

  return row;
}

/** Todas las filas de una muestra (una por clamshell). */
export function buildMuestraRows(m: Muestra): string[][] {
  const ordered = [...m.clamshells].sort((a, b) => a.nClamshell - b.nClamshell);
  return ordered.map((cs, i) => buildRow124(m, cs, i === 0));
}

/** Serializa filas a texto delimitado por tabulaciones para el portapapeles. */
export function rowsToTSV(rows: string[][]): string {
  return rows.map((r) => r.join("\t")).join("\r\n");
}
