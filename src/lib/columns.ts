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
/** Convierte a número real de JS (no texto) para las columnas que SÍ son
 *  numéricas — ver el porqué en el comentario grande de más abajo. `null`/
 *  vacío cae en "" (celda vacía), nunca en 0 falso. */
const n = (v: number | null | undefined): number | string => (v == null ? "" : v);

/**
 * Construye el arreglo de 130 valores para UNA fila (un clamshell), en el
 * orden exacto del maestro, listo para pegar / exportar.
 *
 * Tipo de cada celda — número real (`number`) vs. texto (`string`):
 * la app SIEMPRE armó las 130 columnas como texto (con `s()`, que hace
 * `String(v)`), incluidas las que son números de verdad (NOTA, N° de
 * clamshell, N° de bayas evaluadas, los conteos de defectos, los %). El
 * cliente reportó que al copiar/pegar esas columnas a su Excel maestro le
 * quedaban en "formato texto" y tenía que arreglarlas una por una (Datos >
 * Texto en columnas) para poder sumarlas/promediarlas. La causa: al generar
 * el .xlsx con SheetJS, una celda con un string ("15") queda con tipo texto
 * de verdad adentro del archivo — a diferencia de una celda con un number
 * (15), que Excel reconoce como numérica apenas se abre o se copia, sin
 * necesidad de convertir nada a mano.
 *
 * Por eso ahora las columnas que son números de verdad usan `n()` (valor
 * numérico real). Las que NO lo son se dejan como texto a propósito, porque
 * convertirlas rompería datos o significado:
 *   - Fechas: ya vienen formateadas "DD/MM/AAAA" como texto fijo (no se
 *     tocan; convertirlas a fecha de Excel cambiaría cómo se ven/ordenan).
 *   - DNI (inspector/empacador): un DNI puede empezar con "0" — un DNI
 *     guardado como número le perdería ese cero para siempre.
 *   - ESTÁNDAR /CLAMSHELL y /EMPACADOR ("CUMPLE"/"NO CUMPLE"), MEDIDA
 *     CORRECTIVA ("SI"/"NO"): son texto por naturaleza, no hay "número" al
 *     que convertirlos.
 *   - Nombres, PLANTA/TURNO/PRODUCTOR/CLIENTE/DESTINO/etc., PESO BRUTO
 *     ESTABLECIDO (admite texto libre, ej. "18.5g" o desglose por
 *     clamshell) y OBSERVACIONES: texto libre por diseño.
 *
 * @param esPrimerClamshell  controla si se emite ESTÁNDAR /EMPACADOR (col 28).
 */
export function buildRowBaseDatos(
  m: Muestra,
  cs: Clamshell,
  esPrimerClamshell: boolean
): (string | number)[] {
  const mr = computeMuestra(m);
  const tier = resolveDestinoTier(m.destino, m.embalajeCaja, m.cliente);
  const cr = computeClamshell(cs, tier);

  const row: (string | number)[] = new Array(130).fill("");

  // Cabecera (1-29)
  row[0] = n(m.idMaestro); // ID — número
  row[1] = n(m.semana); // SEMANA — número
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
  row[18] = s(m.dniInspector); // DNI — texto (no perder ceros a la izquierda)
  row[19] = s(m.inspector);
  row[20] = s(m.supervisor);
  row[21] = s(m.dniEmpacador); // DNI — texto (ídem)
  row[22] = s(m.empacador);
  row[23] = n(cs.nBayasEvaluadas); // N° BAYAS EVALUADAS — número
  row[24] = n(cs.nClamshell); // N° DE CLAMSHELL EVALUADO — número
  row[25] = n(cr.nota); // NOTA — número (15 / 5)
  row[26] = cr.estandar; // CUMPLE / NO CUMPLE — texto
  row[27] = esPrimerClamshell ? mr.estandarEmpacador : "";
  row[28] = s(m.medidaCorrectiva);

  // Conteos (30-73, índices 29-72) — números — y OBSERVACIONES (74, índice 73) — texto
  for (const d of DEFECTS) row[d.countCol - 1] = n(cs.counts[d.key] || 0);
  row[73] = s(cs.observacion);

  // Porcentajes (75-118, índices 74-117) — número, como fracción (Excel los
  // muestra con formato %; antes se guardaban como texto con 6 decimales).
  for (const d of DEFECTS) {
    row[d.pctCol - 1] = cr.defectPct[d.key] || 0;
  }

  // Rollups (119-130, índices 118-129) — número, misma fracción
  for (let i = 0; i < ROLLUP_ORDER.length; i++) {
    row[118 + i] = cr.rollupPct[ROLLUP_ORDER[i]] || 0;
  }

  return row;
}

/** Todas las filas de una muestra (una por clamshell). */
export function buildMuestraRows(m: Muestra): (string | number)[][] {
  const ordered = [...m.clamshells].sort((a, b) => a.nClamshell - b.nClamshell);
  return ordered.map((cs, i) => buildRowBaseDatos(m, cs, i === 0));
}

/** Serializa filas a texto delimitado por tabulaciones para el portapapeles.
 *  `String(número)` da el mismo texto plano de siempre (ej. "15",
 *  "0.020408") — el portapapeles siempre viaja como texto sin importar el
 *  tipo de cada celda; Excel ya reconocía estos valores como número al
 *  pegarlos (este truco de tipo real solo hacía falta para el .xlsx). */
export function rowsToTSV(rows: (string | number)[][]): string {
  return rows.map((r) => r.join("\t")).join("\r\n");
}
