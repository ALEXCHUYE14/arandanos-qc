/**
 * CATÁLOGO DE DEFECTOS — BH-F-CCA-006
 * ------------------------------------------------------------------
 * Extraído 1:1 de la hoja "Defectos" y "Base de Datos" del Excel maestro
 * actualizado ("BH-F-CCA-006. Base de Datos de la Inspección de la Calidad
 * en PT - Línea de Empaque (1).xlsx").
 *
 * Cambio de fondo respecto de la versión anterior: la tolerancia YA NO es un
 * único valor global por categoría — depende del DESTINO de la muestra (hoja
 * "Defectos", columnas CHINA / EUROPA-USA / USA SWEETEST BATCH). Ver
 * `resolveDestinoTier` más abajo para cómo se decide cuál aplica.
 *
 * - Cada defecto se cuenta como N° de bayas afectadas (entero >= 0).
 * - `countCol` = columna (1-based) del CONTEO en el maestro (cols 30-73).
 * - `pctCol`   = columna (1-based) del PORCENTAJE en el maestro (cols 75-118).
 * - `category` = 'aprovechable' (leves) | 'descarte' (críticos). Determina
 *                el cálculo de KPIs Cat 1 / Aprovechable / Descarte.
 * - `rollup`   = CLASIFICACIÓN de la hoja "Defectos", usada para el veredicto
 *                CUMPLE/NO CUMPLE contra la tolerancia del destino.
 *
 * El % de cada defecto = conteo / N° de bayas evaluadas (del clamshell).
 */

export type DefectCategory = "aprovechable" | "descarte";

/** Las 12 CLASIFICACIÓN de la hoja "Defectos" (3 aprovechables + 9 de descarte). */
export type RollupKey =
  | "immadurez_leve"
  | "residuos_cosecha"
  | "otros_defectos_leves"
  | "pudricion_hongo"
  | "exudacion"
  | "blando"
  | "deshidratado"
  | "dano_ave"
  | "insectos"
  | "immadurez_severa"
  | "otros_defectos_criticos"
  | "tamano";

/**
 * Nivel de tolerancia por destino (columnas de la hoja "Defectos"):
 * - "china": destino = CHINA.
 * - "europa_usa": destino = EUROPA, o USA sin embalaje "sweetest batch".
 * - "usa_sweetest_batch": destino = USA CON embalaje caja "... SWEETEST BATCH"
 *   (ej. "DRISCOLL'S SWEETEST BATCH") — tolerancia más estricta.
 * - "china_ozblue": destino = CHINA Y cliente = OZBLUE — excepción puntual
 *   confirmada con el usuario (09/09/2026): OZBLUE tiene un tope más laxo
 *   para TAMAÑO/BAJO CALIBRE en China (5% vs. 1% del resto de clientes). NO
 *   es un nivel general: las otras 11 CLASIFICACIONES no tienen un valor
 *   propio para "china_ozblue" (ver TOLERANCES más abajo) y toleranceMax()
 *   cae al tope normal de China para esas — confirmado con el usuario que
 *   el alcance es solo Tamaño, no las 12 clasificaciones.
 */
export type DestinoTier = "china" | "europa_usa" | "usa_sweetest_batch" | "china_ozblue";

/**
 * Decide qué columna de tolerancia aplica según el destino, el embalaje y el
 * cliente. "USA SWEETEST BATCH" no es un valor de DESTINO en la Lista
 * Maestra del cliente (los destinos válidos son CHINA / USA / EUROPA) — es
 * una variante más estricta que se activa por el embalaje caja cuando el
 * destino es USA; "china_ozblue" es análoga pero por CLIENTE en vez de
 * embalaje, y solo más laxa para Tamaño (ver DestinoTier arriba). Ante un
 * destino vacío o desconocido, cae en "europa_usa" (la tolerancia
 * intermedia, ni la más laxa ni la más estricta) en vez de romper el cálculo.
 */
export function resolveDestinoTier(destino: string, embalajeCaja: string, cliente: string = ""): DestinoTier {
  const d = (destino || "").trim().toUpperCase();
  if (d === "CHINA") {
    if ((cliente || "").trim().toUpperCase() === "OZBLUE") return "china_ozblue";
    return "china";
  }
  if (d === "USA" && /SWEETEST\s*BATCH/i.test(embalajeCaja || "")) return "usa_sweetest_batch";
  return "europa_usa";
}

export interface DefectDef {
  key: string;
  label: string; // etiqueta exacta del Excel
  countCol: number; // columna de conteo en el maestro (1-based)
  pctCol: number; // columna de % en el maestro (1-based)
  category: DefectCategory;
  rollup: RollupKey;
}

export const DEFECTS: DefectDef[] = [
  // ── DEFECTOS APROVECHABLES (leves) — cols 30-42 ────────────────────────────
  { key: "desgarro_leve_seco", label: "DESGARRO LEVE SECO", countCol: 30, pctCol: 75, category: "aprovechable", rollup: "otros_defectos_leves" },
  { key: "corola", label: "PRESENCIA DE COROLA", countCol: 31, pctCol: 76, category: "aprovechable", rollup: "residuos_cosecha" },
  { key: "resto_floral_verde", label: "PRESENCIA DE RESTO FLORAL VERDE", countCol: 32, pctCol: 77, category: "aprovechable", rollup: "residuos_cosecha" },
  { key: "pedunculo", label: "PRESENCIA DE PEDÚNCULO", countCol: 33, pctCol: 78, category: "aprovechable", rollup: "residuos_cosecha" },
  { key: "poca_bloom", label: "POCA PRESENCIA DE BLOOM", countCol: 34, pctCol: 79, category: "aprovechable", rollup: "otros_defectos_leves" },
  { key: "sin_bloom", label: "SIN BLOOM", countCol: 35, pctCol: 80, category: "aprovechable", rollup: "otros_defectos_leves" },
  { key: "rojo_grado_1", label: "ROJO GRADO 1", countCol: 36, pctCol: 81, category: "aprovechable", rollup: "immadurez_leve" },
  { key: "aro_pedicelar_verde_leve", label: "ARO PEDICELAR VERDE LEVE", countCol: 37, pctCol: 82, category: "aprovechable", rollup: "otros_defectos_leves" },
  { key: "trips_leve", label: "DAÑO DE TRIPS LEVE", countCol: 38, pctCol: 83, category: "aprovechable", rollup: "otros_defectos_leves" },
  { key: "insercion_pedunculo_leve", label: "INSERCIÓN DE PEDÚNCULO LEVE", countCol: 39, pctCol: 84, category: "aprovechable", rollup: "otros_defectos_leves" },
  { key: "polvo_leve", label: "POLVO LEVE", countCol: 40, pctCol: 85, category: "aprovechable", rollup: "otros_defectos_leves" },
  { key: "deforme", label: "DEFORME", countCol: 41, pctCol: 86, category: "aprovechable", rollup: "otros_defectos_leves" },
  { key: "cera_abeja", label: "CERA DE ABEJA", countCol: 42, pctCol: 87, category: "aprovechable", rollup: "otros_defectos_leves" },

  // ── DEFECTOS DESCARTE (críticos) — cols 43-73 ──────────────────────────────
  { key: "deshidratado_leve", label: "DESHIDRATADO LEVE", countCol: 43, pctCol: 88, category: "descarte", rollup: "deshidratado" },
  { key: "deshidratado_extremo", label: "DESHIDRATADO EXTREMO", countCol: 44, pctCol: 89, category: "descarte", rollup: "deshidratado" },
  { key: "deshidratado_inmaduro", label: "DESHIDRATADO INMADURO", countCol: 45, pctCol: 90, category: "descarte", rollup: "deshidratado" },
  { key: "desgarro_leve_mojado", label: "DESGARRO LEVE MOJADO", countCol: 46, pctCol: 91, category: "descarte", rollup: "exudacion" },
  { key: "pulpa_expuesta", label: "PULPA EXPUESTA", countCol: 47, pctCol: 92, category: "descarte", rollup: "exudacion" },
  { key: "partidos_rajados", label: "PARTIDOS/RAJADOS", countCol: 48, pctCol: 93, category: "descarte", rollup: "exudacion" },
  { key: "insercion_pedunculo_extremo", label: "INSERCIÓN DE PEDÚNCULO EXTREMO", countCol: 49, pctCol: 94, category: "descarte", rollup: "exudacion" },
  { key: "exudados", label: "EXUDADOS", countCol: 50, pctCol: 95, category: "descarte", rollup: "exudacion" },
  { key: "aplastados", label: "APLASTADOS", countCol: 51, pctCol: 96, category: "descarte", rollup: "exudacion" },
  { key: "desgarro_grado_2", label: "DESGARRO GRADO 2 A MÁS", countCol: 52, pctCol: 97, category: "descarte", rollup: "exudacion" },
  { key: "blando", label: "BLANDO", countCol: 53, pctCol: 98, category: "descarte", rollup: "blando" },
  { key: "colapsado", label: "COLAPSADO", countCol: 54, pctCol: 99, category: "descarte", rollup: "blando" },
  { key: "picado_ave", label: "PICADO DE AVE", countCol: 55, pctCol: 100, category: "descarte", rollup: "dano_ave" },
  { key: "picado_ave_pudricion", label: "PICADO DE AVE CON PUDRICIÓN", countCol: 56, pctCol: 101, category: "descarte", rollup: "pudricion_hongo" },
  { key: "podrido", label: "PODRIDO", countCol: 57, pctCol: 102, category: "descarte", rollup: "pudricion_hongo" },
  { key: "hongo", label: "HONGO", countCol: 58, pctCol: 103, category: "descarte", rollup: "pudricion_hongo" },
  { key: "fumagina", label: "FUMAGINA", countCol: 59, pctCol: 104, category: "descarte", rollup: "pudricion_hongo" },
  { key: "larva", label: "PRESENCIA DE LARVA", countCol: 60, pctCol: 105, category: "descarte", rollup: "insectos" },
  { key: "vestigios", label: "VESTIGIOS", countCol: 61, pctCol: 106, category: "descarte", rollup: "otros_defectos_criticos" },
  { key: "chanchito_blanco", label: "CHANCHITO BLANCO", countCol: 62, pctCol: 107, category: "descarte", rollup: "insectos" },
  { key: "excreta_ave", label: "EXCRETA DE AVE", countCol: 63, pctCol: 108, category: "descarte", rollup: "otros_defectos_criticos" },
  { key: "picado_insectos", label: "PICADO DE INSECTOS", countCol: 64, pctCol: 109, category: "descarte", rollup: "otros_defectos_criticos" },
  { key: "rojo_grado_2", label: "ROJO GRADO 2 A MÁS", countCol: 65, pctCol: 110, category: "descarte", rollup: "immadurez_severa" },
  { key: "inmaduro_verde", label: "IMMADURO VERDE", countCol: 66, pctCol: 111, category: "descarte", rollup: "immadurez_severa" },
  { key: "desorden_maduracion", label: "DESORDEN POR MADURACIÓN", countCol: 67, pctCol: 112, category: "descarte", rollup: "immadurez_severa" },
  { key: "polvo_extremo", label: "POLVO EXTREMO", countCol: 68, pctCol: 113, category: "descarte", rollup: "otros_defectos_criticos" },
  { key: "aro_pedicelar_verde_extremo", label: "ARO PEDICELAR VERDE EXTREMO", countCol: 69, pctCol: 114, category: "descarte", rollup: "immadurez_severa" },
  { key: "trips_extremo", label: "DAÑO DE TRIPS EXTREMO", countCol: 70, pctCol: 115, category: "descarte", rollup: "otros_defectos_criticos" },
  { key: "dano_mecanico", label: "DAÑO MECÁNICO", countCol: 71, pctCol: 116, category: "descarte", rollup: "otros_defectos_criticos" },
  { key: "manchas_extranas", label: "MANCHAS EXTRAÑAS", countCol: 72, pctCol: 117, category: "descarte", rollup: "otros_defectos_criticos" },
  { key: "bajo_calibre", label: "BAJO CALIBRE", countCol: 73, pctCol: 118, category: "descarte", rollup: "tamano" },
];

export const DEFECT_BY_KEY: Record<string, DefectDef> = Object.fromEntries(
  DEFECTS.map((d) => [d.key, d])
);

export const APROVECHABLES = DEFECTS.filter((d) => d.category === "aprovechable");
export const DESCARTES = DEFECTS.filter((d) => d.category === "descarte");

/**
 * TOLERANCIAS — hoja "Defectos", una fila por CLASIFICACIÓN con 3 columnas
 * (China / Europa-USA / USA Sweetest Batch). `max` es el % máximo (fracción
 * 0-1) que aún se considera CUMPLE para ese destino; NO CUMPLE cuando el %
 * de la categoría es estrictamente mayor.
 *
 * A diferencia de la versión anterior del sistema, acá NO hay un tope global
 * de "suma total de defectos" — el cliente lo sacó de su planilla; el
 * veredicto depende solo de que cada CLASIFICACIÓN esté dentro de su tope.
 */
export interface ToleranceDef {
  key: RollupKey;
  label: string;
  china: number;
  europa_usa: number;
  usa_sweetest_batch: number;
  /**
   * Excepción China + cliente OZBLUE (ver DestinoTier). Opcional: solo
   * "tamano" la define por ahora (confirmado con el usuario, 09/09/2026);
   * las demás filas quedan sin este valor a propósito, y toleranceMax()
   * cae al tope normal de "china" cuando no está definida.
   */
  chinaOzblue?: number;
}

export const TOLERANCES: ToleranceDef[] = [
  { key: "immadurez_leve", label: "IMMADUREZ LEVE", china: 0.03, europa_usa: 0.02, usa_sweetest_batch: 0 },
  { key: "residuos_cosecha", label: "RESIDUOS DE COSECHA", china: 0.03, europa_usa: 0.04, usa_sweetest_batch: 0.01 },
  { key: "otros_defectos_leves", label: "OTROS DEFECTOS LEVES", china: 0.03, europa_usa: 0.03, usa_sweetest_batch: 0.02 },
  { key: "pudricion_hongo", label: "PUDRICIÓN/HONGO", china: 0, europa_usa: 0, usa_sweetest_batch: 0 },
  { key: "exudacion", label: "EXUDACIÓN", china: 0, europa_usa: 0, usa_sweetest_batch: 0 },
  { key: "blando", label: "BLANDO", china: 0, europa_usa: 0, usa_sweetest_batch: 0 },
  { key: "deshidratado", label: "DESHIDRATADO", china: 0, europa_usa: 0, usa_sweetest_batch: 0 },
  { key: "dano_ave", label: "DAÑO POR AVE", china: 0, europa_usa: 0, usa_sweetest_batch: 0 },
  { key: "insectos", label: "INSECTOS", china: 0, europa_usa: 0, usa_sweetest_batch: 0 },
  { key: "immadurez_severa", label: "IMMADUREZ SEVERA", china: 0, europa_usa: 0, usa_sweetest_batch: 0 },
  { key: "otros_defectos_criticos", label: "OTROS DEFECTOS CRÍTICOS", china: 0, europa_usa: 0, usa_sweetest_batch: 0 },
  // Tolerancia real confirmada por el usuario (09/09/2026) — antes las 3
  // columnas estaban en 0 (pendiente de dato). usa_sweetest_batch se deja
  // en 0: el usuario no dio un valor nuevo para esa columna, solo para
  // China/Europa-USA/China+OZBLUE.
  { key: "tamano", label: "TAMAÑO", china: 0.01, europa_usa: 0.03, usa_sweetest_batch: 0, chinaOzblue: 0.05 },
];

export const TOLERANCE_BY_KEY: Record<RollupKey, ToleranceDef> = Object.fromEntries(
  TOLERANCES.map((t) => [t.key, t])
) as Record<RollupKey, ToleranceDef>;

/** El máximo (0-1) de una tolerancia para un destino puntual. */
export function toleranceMax(tol: ToleranceDef, tier: DestinoTier): number {
  if (tier === "china_ozblue") return tol.chinaOzblue ?? tol.china;
  return tier === "china" ? tol.china : tier === "usa_sweetest_batch" ? tol.usa_sweetest_batch : tol.europa_usa;
}

/** Los 12 rollups en el orden exacto de las columnas del maestro (descarte primero, luego aprovechables). */
export const ROLLUP_ORDER: RollupKey[] = [
  "pudricion_hongo",
  "exudacion",
  "blando",
  "deshidratado",
  "dano_ave",
  "insectos",
  "immadurez_severa",
  "otros_defectos_criticos",
  "tamano",
  "immadurez_leve",
  "residuos_cosecha",
  "otros_defectos_leves",
];

export const ROLLUP_LABEL: Record<RollupKey, string> = Object.fromEntries(
  TOLERANCES.map((t) => [t.key, t.label])
) as Record<RollupKey, string>;

/** NOTA que representa un clamshell 100% conforme (ESTÁNDAR = CUMPLE). */
export const NOTA_CUMPLE = 15;
