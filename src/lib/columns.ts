/**
 * MAPA DE LAS 130 COLUMNAS DEL EXCEL MAESTRO (hoja "Base de Datos").
 * ------------------------------------------------------------------
 * El orden aquí es EXACTO al del archivo que envió el cliente ("BH-F-CCA-006.
 * Base de Datos de la Inspección de la Calidad en PT - Línea de Empaque").
 * Es lo que garantiza que "Copiar fila para Excel Maestro" pegue con Ctrl+V
 * sin descuadrar ni una sola celda ni tocar los encabezados existentes.
 *
 * Cada fila del Excel = un clamshell. Los campos de cabecera se repiten en
 * cada fila del mismo lote; ESTÁNDAR /EMPACADOR solo se llena en el primer
 * clamshell de la muestra (igual que la fórmula original).
 */

import { DEFECTS, ROLLUP_ORDER, ROLLUP_LABEL } from "./defects";
import { computeMuestra, computeClamshell, resolveDestinoTier } from "./calc";
import type { Clamshell, Muestra } from "./types";

/** Encabezados literales de las 130 columnas, en orden (col 1 → col 130). */
export const HEADERS_BASE_DATOS: string[] = [
  "ID",
  "SEMANA",
  "HORA DE EVALUACIÓN",
  "FECHA DE COSECHA",
  "FECHA DE EMPAQUE",
  "PLANTA DE EMPAQUE",
  "TURNO DE EMPAQUE",
  "PRODUCTOR",
  "CLIENTE",
  "DESTINO",
  "VARIEDAD",
  "FORMATO",
  "TIPO DE EMPAQUE",
  "CALIBRE",
  "EMBALAJE CAJA",
  "ETIQUETA CLAMSHELL",
  "PESO BRUTO ESTABLECIDO",
  "INTERVALO DE COSECHA",
  "DNI\nINSPECTOR CALIDAD",
  "APELLIDOS Y NOMBRE\nINSPECTOR CALIDAD",
  "SUPERVISOR DE PRODUCCIÓN",
  "DNI EMPACADOR",
  "APELLIDOS Y NOMBRE\nEMPACADOR",
  "N° BAYAS EVALUADAS",
  "N° DE CLAMSHELL EVALUADO",
  "NOTA",
  "ESTANDAR DE CALIDAD /CLAMSHELL",
  "ESTANDAR DE CALIDAD /EMPACADOR",
  "MEDIDA CORRECTIVA APLICADA",
  // Conteos de defectos (30-73)
  ...DEFECTS.map((d) => d.label),
  "OBSERVACIONES",
  // Porcentajes de defectos (75-118)
  ...DEFECTS.map((d) => `${d.label} (%)`),
  // Rollups: descarte (119-127) luego aprovechables (128-130)
  ...ROLLUP_ORDER.map((r) => ROLLUP_LABEL[r]),
];

/** Defecto por columna de conteo y por columna de porcentaje. */
const DEFECT_BY_COUNT_COL = new Map(DEFECTS.map((d) => [d.countCol, d]));
const DEFECT_BY_PCT_COL = new Map(DEFECTS.map((d) => [d.pctCol, d]));

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

const s = (v: unknown): string => (v == null ? "" : String(v));

/**
 * Construye el arreglo de 130 valores para UNA fila (un clamshell), en el
 * orden exacto del maestro. Devuelve strings listos para pegar / exportar.
 *
 * @param esPrimerClamshell  controla si se emite ESTÁNDAR /EMPACADOR (col 28).
 */
export function buildRowBaseDatos(
  m: Muestra,
  cs: Clamshell,
  esPrimerClamshell: boolean
): string[] {
  const mr = computeMuestra(m);
  const tier = resolveDestinoTier(m.destino, m.embalajeCaja, m.cliente);
  const cr = computeClamshell(cs, tier);

  const row: string[] = new Array(130).fill("");

  // Cabecera (1-29)
  row[0] = s(m.idMaestro);
  row[1] = s(m.semana);
  row[2] = s(m.horaEvaluacion);
  row[3] = fmtDate(m.fechaCosecha);
  row[4] = fmtDate(m.fechaEmpaque);
  row[5] = s(m.plantaEmpaque);
  row[6] = s(m.turno);
  row[7] = s(m.productor);
  row[8] = s(m.cliente);
  row[9] = s(m.destino);
  row[10] = s(m.variedad);
  row[11] = s(m.formato);
  row[12] = s(m.tipoEmpaque);
  row[13] = s(m.calibre);
  row[14] = s(m.embalajeCaja);
  row[15] = s(m.embalajeClamshell);
  row[16] = s(m.pesoEstablecido);
  row[17] = s(m.intervaloCosecha);
  row[18] = s(m.dniInspector);
  row[19] = s(m.inspector);
  row[20] = s(m.supervisor);
  row[21] = s(m.dniEmpacador);
  row[22] = s(m.empacador);
  row[23] = s(cs.nBayasEvaluadas);
  row[24] = s(cs.nClamshell);
  row[25] = s(cr.nota);
  row[26] = cr.estandar;
  row[27] = esPrimerClamshell ? mr.estandarEmpacador : "";
  row[28] = s(m.medidaCorrectiva);

  // Conteos (30-73, índices 29-72) y OBSERVACIONES (74, índice 73)
  for (const d of DEFECTS) row[d.countCol - 1] = s(cs.counts[d.key] || 0);
  row[73] = s(cs.observacion);

  // Porcentajes (75-118, índices 74-117) — como fracción (Excel los muestra con formato %)
  for (const d of DEFECTS) {
    const pct = cr.defectPct[d.key] || 0;
    row[d.pctCol - 1] = pct ? pct.toFixed(6) : "0";
  }

  // Rollups (119-130, índices 118-129)
  for (let i = 0; i < ROLLUP_ORDER.length; i++) {
    const pct = cr.rollupPct[ROLLUP_ORDER[i]] || 0;
    row[118 + i] = pct ? pct.toFixed(6) : "0";
  }

  return row;
}

/** Todas las filas de una muestra (una por clamshell). */
export function buildMuestraRows(m: Muestra): string[][] {
  const ordered = [...m.clamshells].sort((a, b) => a.nClamshell - b.nClamshell);
  return ordered.map((cs, i) => buildRowBaseDatos(m, cs, i === 0));
}

/** Serializa filas a texto delimitado por tabulaciones para el portapapeles. */
export function rowsToTSV(rows: string[][]): string {
  return rows.map((r) => r.join("\t")).join("\r\n");
}
