/**
 * MOTOR DE CÁLCULO — replica exacta de las fórmulas del Excel maestro BH-F-CCA-006.
 *
 * Reglas (verificadas contra las hojas "Base de Datos" y "Defectos"):
 *   • % de defecto            = conteo / N° bayas evaluadas.
 *   • % rollup (CLASIFICACIÓN) = suma de conteos de la categoría / N° bayas evaluadas.
 *   • Aprovechable y Descarte determinan los KPIs Cat 1 / Aprovechable / Descarte.
 *   • Cat 1 %  = 1 − %Aprovechable − %Descarte.
 *   • ESTÁNDAR /CLAMSHELL = IF(NOTA=15,"CUMPLE","NO CUMPLE").
 *   • ESTÁNDAR /EMPACADOR = "NO CUMPLE" si algún clamshell de la muestra NO CUMPLE.
 *   • Veredicto por tolerancias: cada rollup <= su umbral — el umbral depende
 *     del DESTINO de la muestra (ver resolveDestinoTier en lib/defects.ts).
 *     No hay tope de "suma total": lo sacó el cliente de su planilla.
 */

import {
  DEFECTS,
  DEFECT_BY_KEY,
  ROLLUP_ORDER,
  TOLERANCE_BY_KEY,
  toleranceMax,
  resolveDestinoTier,
  NOTA_CUMPLE,
  type RollupKey,
  type DestinoTier,
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

/**
 * Cálculo completo de un clamshell. `tier` decide qué columna de tolerancia
 * (China / Europa-USA / USA Sweetest Batch) aplica — se resuelve una vez por
 * muestra en `computeMuestra` y se pasa acá para no repetir el cálculo por
 * cada clamshell.
 */
export function computeClamshell(cs: Clamshell, tier: DestinoTier = "europa_usa"): ClamshellResult {
  const bayas = cs.nBayasEvaluadas || 0;
  const counts = cs.counts || {};

  const totalDefectos = sumCounts(counts);
  const aprovechableCount = categoryCount(counts, "aprovechable");
  const descarteCount = categoryCount(counts, "descarte");

  // % por defecto individual
  const defectPct: Record<string, number> = {};
  for (const d of DEFECTS) defectPct[d.key] = div(counts[d.key] || 0, bayas);

  // % por rollup + veredicto por tolerancia (según destino)
  const rollupPct: Record<string, number> = {};
  const rollupCumple: Record<string, boolean> = {};
  for (const r of ROLLUP_ORDER) {
    const pct = div(rollupCount(counts, r), bayas);
    rollupPct[r] = pct;
    const tol = TOLERANCE_BY_KEY[r];
    rollupCumple[r] = tol ? pct <= toleranceMax(tol, tier) + 1e-9 : true;
  }

  const sumaPct = div(totalDefectos, bayas);

  // Veredicto por tolerancias: todos los rollups dentro de su tope para este destino.
  const toleranciasOk = ROLLUP_ORDER.every((r) => rollupCumple[r]);

  // NOTA: si el inspector la fijó se respeta; si no, se deriva del veredicto.
  // La planilla del cliente solo usa 5 (no cumple) y 15 (cumple) como notas
  // válidas (hoja "Lista Maestra"), así que el fallback derivado usa 5, no 0.
  const nota = cs.nota != null ? cs.nota : toleranciasOk ? NOTA_CUMPLE : 5;
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
  const tier = resolveDestinoTier(m.destino, m.embalajeCaja, m.cliente);
  const clamshells = (m.clamshells || []).map((cs) => computeClamshell(cs, tier));

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

/**
 * % de una tolerancia a partir del cual se considera "en riesgo" — todavía
 * CUMPLE, pero cerca del límite. 0.8 = dentro del 20% superior del umbral.
 * Es un valor por defecto razonable, no un dato del Excel maestro: ajustar
 * acá si Jefatura de Calidad prefiere otro margen de alerta temprana.
 */
const RISK_THRESHOLD = 0.8;

/**
 * true si la muestra CUMPLE pero al menos un rollup de alguno de sus
 * clamshells ya está a partir de RISK_THRESHOLD de su tolerancia máxima (para
 * el destino de esta muestra) — alerta temprana antes de que la próxima
 * muestra del mismo lote pase a NO CUMPLE. Una muestra que ya es NO CUMPLE
 * no se marca "en riesgo": ese caso ya se ve con el badge de NO CUMPLE.
 */
export function computeRiesgo(m: Muestra): boolean {
  const r = computeMuestra(m);
  if (!r.cumple) return false;
  const tier = resolveDestinoTier(m.destino, m.embalajeCaja, m.cliente);
  return r.clamshells.some((cs) =>
    ROLLUP_ORDER.some((k) => {
      const tol = TOLERANCE_BY_KEY[k];
      const max = tol ? toleranceMax(tol, tier) : 0;
      // Tolerancia 0: cualquier ocurrencia ya es NO CUMPLE, no hay una zona
      // intermedia "en riesgo" que marcar acá.
      return max > 0 && cs.rollupPct[k] >= max * RISK_THRESHOLD;
    })
  );
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
    nBayasEvaluadas: 99,
    counts,
    nota: null,
    observacion: "",
  };
}

/** Asegura que un objeto de conteos tenga todas las claves de defecto. */
export function normalizeCounts(counts?: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of DEFECTS) out[d.key] = counts?.[d.key] ?? 0;
  return out;
}

export { DEFECT_BY_KEY, resolveDestinoTier };
export type { DestinoTier };
