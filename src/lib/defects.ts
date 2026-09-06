/**
 * CATÁLOGO DE DEFECTOS — BH-F-CCA-006
 * ------------------------------------------------------------------
 * Extraído 1:1 de la hoja "Base de Datos" del Excel maestro.
 *
 * - Cada defecto se cuenta como N° de bayas afectadas (entero >= 0).
 * - `countCol`  = índice de columna (1-based) del CONTEO en el Excel (cols 27-71).
 * - `pctCol`    = índice de columna del PORCENTAJE en el Excel (cols 73-115) o null
 *                 (IMMADURO VERDE y CERA DE ABEJA EXTREMO no tienen columna % en el maestro).
 * - `category`  = 'aprovechable' (defectos leves, cols 27-38) | 'descarte' (críticos, cols 39-71).
 *                 Determina el cálculo de KPIs Cat 1 / Aprovechable / Descarte.
 * - `rollup`    = categoría de tolerancia (cols 116-124) usada para el veredicto CUMPLE/NO CUMPLE.
 *
 * El % de cada defecto = conteo / N° de bayas evaluadas (del clamshell).
 */

export type DefectCategory = "aprovechable" | "descarte";

export type RollupKey =
  | "pudricion_hongo"
  | "exudacion"
  | "blando"
  | "deshidratado"
  | "residuos_cosecha"
  | "defectos_apariencia"
  | "otros"
  | "tamano"
  | "insectos";

export interface DefectDef {
  key: string;
  label: string; // etiqueta exacta del Excel
  countCol: number; // columna de conteo en el maestro (1-based)
  pctCol: number | null; // columna de % en el maestro (1-based)
  category: DefectCategory;
  rollup: RollupKey | null;
}

export const DEFECTS: DefectDef[] = [
  // ── DEFECTOS APROVECHABLES (leves) — cols 27-38 ────────────────────────────
  { key: "desgarro_leve_seco", label: "DESGARRO LEVE SECO", countCol: 27, pctCol: 73, category: "aprovechable", rollup: "otros" },
  { key: "corola", label: "PRESENCIA DE COROLA", countCol: 28, pctCol: 74, category: "aprovechable", rollup: "residuos_cosecha" },
  { key: "resto_floral_verde", label: "PRESENCIA DE RESTO FLORAL VERDE", countCol: 29, pctCol: 75, category: "aprovechable", rollup: "residuos_cosecha" },
  { key: "pedunculo", label: "PRESENCIA DE PEDÚNCULO", countCol: 30, pctCol: 76, category: "aprovechable", rollup: "residuos_cosecha" },
  { key: "poca_bloom", label: "POCA PRESENCIA DE BLOOM", countCol: 31, pctCol: 77, category: "aprovechable", rollup: "defectos_apariencia" },
  { key: "rojo_grado_1", label: "ROJO GRADO 1", countCol: 32, pctCol: 78, category: "aprovechable", rollup: "defectos_apariencia" },
  { key: "aro_pedicelar_verde_leve", label: "ARO PEDICELAR VERDE LEVE", countCol: 33, pctCol: 79, category: "aprovechable", rollup: "defectos_apariencia" },
  { key: "trips_leve", label: "DAÑO DE TRIPS LEVE", countCol: 34, pctCol: 80, category: "aprovechable", rollup: "otros" },
  { key: "insercion_pedunculo_leve", label: "INSERCIÓN DE PEDÚNCULO LEVE", countCol: 35, pctCol: 81, category: "aprovechable", rollup: "defectos_apariencia" },
  { key: "polvo_leve", label: "POLVO LEVE", countCol: 36, pctCol: 82, category: "aprovechable", rollup: "otros" },
  { key: "deforme", label: "DEFORME", countCol: 37, pctCol: 83, category: "aprovechable", rollup: "otros" },
  { key: "cera_abeja", label: "CERA DE ABEJA", countCol: 38, pctCol: 84, category: "aprovechable", rollup: "otros" },

  // ── DEFECTOS DESCARTE (críticos) — cols 39-71 ──────────────────────────────
  { key: "deshidratado_leve", label: "DESHIDRATADO LEVE", countCol: 39, pctCol: 85, category: "descarte", rollup: "deshidratado" },
  { key: "deshidratado_extremo", label: "DESHIDRATADO EXTREMO", countCol: 40, pctCol: 86, category: "descarte", rollup: "deshidratado" },
  { key: "deshidratado_inmaduro", label: "DESHIDRATADO INMADURO", countCol: 41, pctCol: 87, category: "descarte", rollup: "deshidratado" },
  { key: "desgarro_leve_mojado", label: "DESGARRO LEVE MOJADO", countCol: 42, pctCol: 88, category: "descarte", rollup: "exudacion" },
  { key: "pulpa_expuesta", label: "PULPA EXPUESTA", countCol: 43, pctCol: 89, category: "descarte", rollup: "exudacion" },
  { key: "partidos_rajados", label: "PARTIDOS/RAJADOS", countCol: 44, pctCol: 90, category: "descarte", rollup: "exudacion" },
  { key: "insercion_pedunculo_extremo", label: "INSERCIÓN DE PEDÚNCULO EXTREMO", countCol: 45, pctCol: 91, category: "descarte", rollup: "exudacion" },
  { key: "exudados", label: "EXUDADOS", countCol: 46, pctCol: 92, category: "descarte", rollup: "exudacion" },
  { key: "aplastados", label: "APLASTADOS", countCol: 47, pctCol: 93, category: "descarte", rollup: "exudacion" },
  { key: "desgarro_grado_2", label: "DESGARRO GRADO 2 A MÁS", countCol: 48, pctCol: 94, category: "descarte", rollup: "exudacion" },
  { key: "blando", label: "BLANDO", countCol: 49, pctCol: 95, category: "descarte", rollup: "blando" },
  { key: "colapsado", label: "COLAPSADO", countCol: 50, pctCol: 96, category: "descarte", rollup: "exudacion" },
  { key: "picado_ave", label: "PICADO DE AVE", countCol: 51, pctCol: 97, category: "descarte", rollup: "otros" },
  { key: "picado_ave_pudricion", label: "PICADO DE AVE CON PUDRICIÓN", countCol: 52, pctCol: 98, category: "descarte", rollup: "pudricion_hongo" },
  { key: "podrido", label: "PODRIDO", countCol: 53, pctCol: 99, category: "descarte", rollup: "pudricion_hongo" },
  { key: "hongo", label: "HONGO", countCol: 54, pctCol: 100, category: "descarte", rollup: "pudricion_hongo" },
  { key: "fumagina", label: "FUMAGINA", countCol: 55, pctCol: 101, category: "descarte", rollup: "otros" },
  { key: "larva", label: "PRESENCIA DE LARVA", countCol: 56, pctCol: 102, category: "descarte", rollup: "insectos" },
  { key: "vestigios", label: "VESTIGIOS", countCol: 57, pctCol: 103, category: "descarte", rollup: "residuos_cosecha" },
  { key: "chanchito_blanco", label: "CHANCHITO BLANCO", countCol: 58, pctCol: 104, category: "descarte", rollup: "insectos" },
  { key: "excreta_ave", label: "EXCRETA DE AVE", countCol: 59, pctCol: 105, category: "descarte", rollup: "otros" },
  { key: "picado_insectos", label: "PICADO DE INSECTOS", countCol: 60, pctCol: 106, category: "descarte", rollup: "otros" },
  { key: "rojo_grado_2", label: "ROJO GRADO 2 A MÁS", countCol: 61, pctCol: 107, category: "descarte", rollup: "defectos_apariencia" },
  { key: "inmaduro_verde", label: "IMMADURO VERDE", countCol: 62, pctCol: null, category: "descarte", rollup: "defectos_apariencia" },
  { key: "desorden_maduracion", label: "DESORDEN POR MADURACIÓN", countCol: 63, pctCol: 108, category: "descarte", rollup: "defectos_apariencia" },
  { key: "polvo_extremo", label: "POLVO EXTREMO", countCol: 64, pctCol: 109, category: "descarte", rollup: "otros" },
  { key: "aro_pedicelar_verde_extremo", label: "ARO PEDICELAR VERDE EXTREMO", countCol: 65, pctCol: 110, category: "descarte", rollup: "defectos_apariencia" },
  { key: "trips_extremo", label: "DAÑO DE TRIPS EXTREMO", countCol: 66, pctCol: 111, category: "descarte", rollup: "otros" },
  { key: "dano_mecanico", label: "DAÑO MECÁNICO", countCol: 67, pctCol: 112, category: "descarte", rollup: "otros" },
  { key: "mancha_aplicacion", label: "MANCHA DE APLICACIÓN", countCol: 68, pctCol: 113, category: "descarte", rollup: "otros" },
  { key: "cera_abeja_extremo", label: "CERA DE ABEJA EXTREMO", countCol: 69, pctCol: null, category: "descarte", rollup: "otros" },
  { key: "sin_bloom", label: "SIN BLOOM", countCol: 70, pctCol: 114, category: "descarte", rollup: "defectos_apariencia" },
  { key: "bajo_calibre", label: "BAJO CALIBRE <10 mm", countCol: 71, pctCol: 115, category: "descarte", rollup: "tamano" },
];

export const DEFECT_BY_KEY: Record<string, DefectDef> = Object.fromEntries(
  DEFECTS.map((d) => [d.key, d])
);

export const APROVECHABLES = DEFECTS.filter((d) => d.category === "aprovechable");
export const DESCARTES = DEFECTS.filter((d) => d.category === "descarte");

/**
 * TOLERANCIAS — hoja "Tolerancias" del Excel maestro.
 * `max` es el porcentaje máximo (fracción 0-1) que aún se considera CUMPLE.
 * NO CUMPLE cuando el % de la categoría es estrictamente mayor que `max`.
 *
 * Nota: RESIDUOS DE COSECHA / DEFECTOS DE APARIENCIA / OTROS comparten el
 * umbral de 5% inferido del layout de la hoja (fila DEFECTOS DE APARIENCIA = 0.0501).
 * Todos los umbrales son parametrizables aquí.
 */
export interface ToleranceDef {
  key: RollupKey | "suma";
  label: string;
  max: number; // fracción 0-1
}

export const TOLERANCES: ToleranceDef[] = [
  { key: "pudricion_hongo", label: "PUDRICIÓN/HONGO", max: 0.0 },
  { key: "exudacion", label: "EXUDACIÓN", max: 0.01 },
  { key: "blando", label: "BLANDO", max: 0.04 },
  { key: "deshidratado", label: "DESHIDRATADO", max: 0.03 },
  { key: "residuos_cosecha", label: "RESIDUOS DE COSECHA", max: 0.05 },
  { key: "defectos_apariencia", label: "DEFECTOS DE APARIENCIA", max: 0.05 },
  { key: "otros", label: "OTROS", max: 0.05 },
  { key: "tamano", label: "TAMAÑO", max: 0.03 },
  { key: "insectos", label: "INSECTOS", max: 0.0 },
];

/** Umbral global: suma de todos los defectos / bayas evaluadas. */
export const TOLERANCE_SUMA: ToleranceDef = {
  key: "suma",
  label: "SUMA TOTAL",
  max: 0.1,
};

export const TOLERANCE_BY_KEY: Record<string, ToleranceDef> = Object.fromEntries(
  [...TOLERANCES, TOLERANCE_SUMA].map((t) => [t.key, t])
);

/** Los 9 rollups de categoría (cols 116-124) en orden. */
export const ROLLUP_ORDER: RollupKey[] = [
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

export const ROLLUP_LABEL: Record<RollupKey, string> = {
  pudricion_hongo: "PUDRICIÓN/HONGO",
  exudacion: "EXUDACIÓN",
  blando: "BLANDO",
  deshidratado: "DESHIDRATADO",
  residuos_cosecha: "RESIDUOS DE COSECHA",
  defectos_apariencia: "DEFECTOS DE APARIENCIA",
  otros: "OTROS",
  tamano: "TAMAÑO",
  insectos: "INSECTOS",
};

/** NOTA que representa un clamshell 100% conforme (ESTÁNDAR = CUMPLE). */
export const NOTA_CUMPLE = 15;
