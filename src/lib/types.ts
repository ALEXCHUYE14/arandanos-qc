/**
 * Tipos de dominio del sistema de control de calidad de arándanos.
 *
 * Jerarquía:
 *   Muestra (lote, código ME-XXXXX)  ──1:N──►  Clamshell (una fila del Excel maestro)
 *
 * Cada clamshell almacena su propio N° de bayas evaluadas y el conteo por defecto.
 * Los porcentajes y veredictos se calculan (ver lib/calc.ts), no se almacenan crudos.
 */

export type Turno = "DÍA" | "NOCHE";
export type Estandar = "CUMPLE" | "NO CUMPLE";
export type SyncStatus = "pending" | "synced" | "error" | "conflict";

/** Conteo de bayas por defecto: { [defectKey]: number }. */
export type DefectCounts = Record<string, number>;

export interface Clamshell {
  id: string; // uuid local
  muestraId: string;
  nClamshell: number; // 1, 2, 3, ...
  nBayasEvaluadas: number; // denominador de los %
  counts: DefectCounts;
  nota: number | null; // 15 = conforme; ver ESTÁNDAR /CLAMSHELL
  observacion: string;
}

export interface Muestra {
  id: string; // uuid local
  codigo: string; // ME-XXXXX
  idMaestro: number | null; // columna ID del Excel (correlativo del maestro)

  // Cabecera / lote
  semana: number | null;
  horaEvaluacion: string; // "HH:MM", opcional
  fechaCosecha: string | null; // ISO yyyy-mm-dd
  fechaEmpaque: string | null;
  /**
   * Planta de Empaque. Antes era un número libre ("N° planta empaque"); el
   * cliente usa etiquetas en vez de un número (ver LISTA_MAESTRA.plantasEmpaque
   * en lib/listaMaestra.ts) — es un campo de catálogo editable como
   * cliente/destino/etc., no un enum cerrado, por si se suma una planta nueva.
   */
  plantaEmpaque: string;
  linea: string; // línea de empaque (metadato del reporte; no forma parte de las columnas del maestro)
  turno: Turno;
  productor: string;
  cliente: string;
  destino: string; // determina qué columna de tolerancia aplica (ver lib/defects.ts)
  variedad: string;
  formato: string;
  tipoEmpaque: string; // "CONVENCIONAL" | "JUMBO" | ...
  calibre: string;
  embalajeCaja: string; // si contiene "SWEETEST BATCH" + destino USA, aplica la tolerancia más estricta
  embalajeClamshell: string; // "ETIQUETA CLAMSHELL" en el maestro
  intervaloCosecha: string;

  // Personal
  dniInspector: string;
  inspector: string;
  supervisor: string;
  dniEmpacador: string;
  empacador: string;

  // Evaluación a nivel muestra
  /**
   * Peso bruto establecido. Texto libre (no número): el inspector necesita
   * poder escribir el desglose por clamshell (ej. "9.5 / 10.2 / 11.0") y no
   * solo un valor único, así que se dejó de forzar solo dígitos.
   */
  pesoEstablecido: string | null;
  medidaCorrectiva: string; // "SI" | "NO" | detalle
  observaciones: string;

  clamshells: Clamshell[];

  // Metadatos
  createdAt: string;
  updatedAt: string;
  createdBy: string; // uid o nombre del inspector
  sync: SyncStatus;
  /**
   * `updated_at` del servidor la última vez que este registro se sincronizó
   * con éxito (null = todavía no existe en el servidor). Es la base contra la
   * que `upsert_muestra_full` detecta conflictos: si alguien más cambió la
   * muestra en el servidor después de esto, la RPC rechaza el push y marca
   * `sync: "conflict"` en vez de pisar silenciosamente ese cambio ajeno.
   */
  baseUpdatedAt: string | null;
}

/** Resultado del cálculo por clamshell. */
export interface ClamshellResult {
  nClamshell: number;
  nBayasEvaluadas: number;
  totalDefectos: number;
  aprovechableCount: number;
  descarteCount: number;
  pctAprovechable: number; // 0-1
  pctDescarte: number; // 0-1
  pctCat1: number; // 0-1
  defectPct: Record<string, number>; // por defecto (0-1)
  rollupPct: Record<string, number>; // por categoría (0-1)
  rollupCumple: Record<string, boolean>;
  sumaPct: number; // 0-1
  cumple: boolean; // veredicto por tolerancias
  nota: number; // nota efectiva
  estandar: Estandar;
}

/** Resultado agregado por muestra. */
export interface MuestraResult {
  totalBayas: number;
  totalDefectos: number;
  aprovechableCount: number;
  descarteCount: number;
  pctCat1: number; // 0-1
  pctAprovechable: number; // 0-1
  pctDescarte: number; // 0-1
  clamshells: ClamshellResult[];
  cumple: boolean; // CUMPLE si TODOS los clamshells cumplen
  estandarEmpacador: Estandar;
}

export interface AppUserProfile {
  id: string;
  nombre: string;
  dni: string;
  rol: "inspector" | "jefatura";
}
