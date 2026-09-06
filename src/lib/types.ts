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
export type SyncStatus = "pending" | "synced" | "error";

/** Conteo de bayas por defecto: { [defectKey]: number }. */
export type DefectCounts = Record<string, number>;

export interface Clamshell {
  id: string; // uuid local
  muestraId: string;
  nClamshell: number; // 1, 2, 3, ...
  peso: number | null; // gramos medidos
  nBayasEvaluadas: number; // denominador de los %
  counts: DefectCounts;
  nota: number | null; // 15 = conforme; ver ESTÁNDAR /CLAMSHELL
  pesoCorrecto: boolean;
  trazabilidadConforme: boolean;
  calibreCorrecto: boolean;
  observacion: string;
}

export interface Muestra {
  id: string; // uuid local
  codigo: string; // ME-XXXXX
  idMaestro: number | null; // columna ID del Excel (correlativo del maestro)

  // Cabecera / lote
  semana: number | null;
  fechaCosecha: string | null; // ISO yyyy-mm-dd
  fechaEmpaque: string | null;
  nPlanta: number | null;
  linea: string; // línea de empaque (metadato del reporte; no forma parte de las 124 columnas)
  turno: Turno;
  productor: string;
  cliente: string;
  destino: string;
  formato: string;
  calibre: string;
  embalajeCaja: string;
  embalajeClamshell: string;
  variedad: string;
  intervaloCosecha: string;

  // Personal
  dniInspector: string;
  inspector: string;
  supervisor: string;
  dniEmpacador: string;
  empacador: string;

  // Evaluación a nivel muestra
  pesoEstablecido: number | null; // peso objetivo del formato (g)
  medidaCorrectiva: string; // "SI" | "NO" | detalle
  observaciones: string;

  clamshells: Clamshell[];

  // Metadatos
  createdAt: string;
  updatedAt: string;
  createdBy: string; // uid o nombre del inspector
  sync: SyncStatus;
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
