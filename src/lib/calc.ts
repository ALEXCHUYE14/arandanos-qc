/**
 * MOTOR DE CÁLCULO — replica exacta de las fórmulas del Excel maestro BH-F-CCA-006.
 *
 * Reglas (verificadas contra la hoja "Base de Datos"):
 *   • % de defecto            = conteo / N° bayas evaluadas.
 *   • % rollup (cat. 116-124) = suma de conteos de la categoría / N° bayas evaluadas.
 *   • Aprovechable (cols 27-38) y Descarte (cols 39-71) determinan los KPIs.
 *   • Cat 1 %  = 1 − %Aprovechable − %Descarte.
 *   • ESTÁNDAR /CLAMSHELL = IF(NOTA=15,"CUMPLE","NO CUMPLE").
 *   • ESTÁNDAR /EMPACADOR = "NO CUMPLE" si algún clamshell de la muestra NO CUMPLE.
 *   • Veredicto por tolerancias: cada rollup <= su umbral y la SUMA <= 10%.
 */

import {
  DEFECTS,
  DEFECT_BY_KEY,
  ROLLUP_ORDER,
  TOLERANCE_BY_KEY,
  TOLERANCE_SUMA,
  NOTA_CUMPLE,
  type RollupKey,
} from "./defects";
import type {
  Clamshell,
  ClamshellResult,
  Muestra,
  MuestraResult,
  Estandar,
} from "./types";

const div = (a: number, b: number): number => (b > 0 ? a / b : 0);

/** Suma de un objeto de conteos. */
export function sumCounts(counts: Record<string, number>): number {
  let t = 0;
  for (const k in counts) t += counts[k] || 0;
  return t;
}

/** Conteo total por categoría KPI (aprovechable / descarte). */
function categoryCount(
  counts: Record<string, number>,
  category: "aprovechable" | "descarte"
): number {
  let t = 0;
  for (const d of DEFECTS) {
    if (d.category === category) t += counts[d.key] || 0;
  }
  return t;
}

/** Conteo por rollup de tolerancia. */
function rollupCount(counts: Record<string, number>, rollup: RollupKey): number {
  let t = 0;
  for (const d of DEFECTS) {
    if (d.rollup === rollup) t += counts[d.key] || 0;
  }
  return t;
}

/** Cálculo completo de un clamshell. */
export function computeClamshell(cs: Clamshell): ClamshellResult {
  const bayas = cs.nBayasEvaluadas || 0;
  const counts = cs.counts || {};

  const totalDefectos = sumCounts(counts);
  const aprovechableCount = categoryCount(counts, "aprovechable");
  const descarteCount = categoryCount(counts, "descarte");

  // % por defecto individual
  const defectPct: Record<string, number> = {};
  for (const d of DEFECTS) defectPct[d.key] = div(counts[d.key] || 0, bayas);

  // % por rollup + veredicto por tolerancia
  const rollupPct: Record<string, number> = {};
  const rollupCumple: Record<string, boolean> = {};
  for (const r of ROLLUP_ORDER) {
    const pct = div(rollupCount(counts, r), bayas);
    rollupPct[r] = pct;
    const tol = TOLERANCE_BY_KEY[r];
    rollupCumple[r] = tol ? pct <= tol.max + 1e-9 : true;
  }

  const sumaPct = div(totalDefectos, bayas);

  // Veredicto por tolerancias: todos los rollups OK y suma total OK
  const toleranciasOk =
    ROLLUP_ORDER.every((r) => rollupCumple[r]) &&
    sumaPct <= TOLERANCE_SUMA.max + 1e-9;

  // NOTA: si el inspector la fijó se respeta; si no, se deriva del veredicto.
  const nota = cs.nota != null ? cs.nota : toleranciasOk ? NOTA_CUMPLE : 0;
  const estandar: Estandar = nota === NOTA_CUMPLE ? "CUMPLE" : "NO CUMPLE";
  const cumple = estandar === "CUMPLE";

  const pctAprovechable = div(aprovechableCount, bayas);
  const pctDescarte = div(descarteCount, bayas);
  const pctCat1 = Math.max(0, 1 - pctAprovechable - pctDescarte);

  return {
    nClamshell: cs.nClamshell,
    nBayasEvaluadas: bayas,
    totalDefectos,
    aprovechableCount,
    descarteCount,
    pctAprovechable,
    pctDescarte,
    pctCat1,
    defectPct,
    rollupPct,
    rollupCumple,
    sumaPct,
    cumple,
    nota,
    estandar,
  };
}

/** Cálculo agregado de una muestra (todos sus clamshells). */
export function computeMuestra(m: Muestra): MuestraResult {
  const clamshells = (m.clamshells || []).map(computeClamshell);

  const totalBayas = clamshells.reduce((s, c) => s + c.nBayasEvaluadas, 0);
  const totalDefectos = clamshells.reduce((s, c) => s + c.totalDefectos, 0);
  const aprovechableCount = clamshells.reduce((s, c) => s + c.aprovechableCount, 0);
  const descarteCount = clamshells.reduce((s, c) => s + c.descarteCount, 0);

  const pctAprovechable = div(aprovechableCount, totalBayas);
  const pctDescarte = div(descarteCount, totalBayas);
  const pctCat1 = Math.max(0, 1 - pctAprovechable - pctDescarte);

  const cumple = clamshells.length > 0 && clamshells.every((c) => c.cumple);
  const estandarEmpacador: Estandar = cumple ? "CUMPLE" : "NO CUMPLE";

  return {
    totalBayas,
    totalDefectos,
    aprovechableCount,
    descarteCount,
    pctCat1,
    pctAprovechable,
    pctDescarte,
    clamshells,
    cumple,
    estandarEmpacador,
  };
}

/** Formatea una fracción 0-1 como porcentaje con 2 decimales (ej. 0.1212 -> "12.12%"). */
export function fmtPct(fraction: number, decimals = 2): string {
  return `${(fraction * 100).toFixed(decimals)}%`;
}

/** Genera un código de muestra ME-XXXXX a partir de un correlativo. */
export function makeCodigo(seq: number): string {
  return `ME-${String(seq).padStart(5, "0")}`;
}

/** Crea un clamshell vacío. */
export function emptyClamshell(muestraId: string, nClamshell: number): Clamshell {
  const counts: Record<string, number> = {};
  for (const d of DEFECTS) counts[d.key] = 0;
  return {
    id: crypto.randomUUID(),
    muestraId,
    nClamshell,
    peso: null,
    nBayasEvaluadas: 99,
    counts,
    nota: null,
    pesoCorrecto: true,
    trazabilidadConforme: true,
    calibreCorrecto: true,
    observacion: "",
  };
}

/** Asegura que un objeto de conteos tenga todas las claves de defecto. */
export function normalizeCounts(counts?: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of DEFECTS) out[d.key] = counts?.[d.key] ?? 0;
  return out;
}

export { DEFECT_BY_KEY };
