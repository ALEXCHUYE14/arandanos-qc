/**
 * Agregaciones para el dashboard de Jefatura de Calidad.
 * Se calculan en cliente sobre las muestras cacheadas (que se sincronizan
 * desde Supabase). Las mismas métricas están disponibles como RPC en Postgres.
 */

import { computeMuestra } from "./calc";
import type { Muestra } from "./types";

export interface OverviewStats {
  totalMuestras: number;
  totalClamshells: number;
  totalBayas: number;
  pctCumplimiento: number; // muestras que cumplen / total
  pctDescartePromedio: number; // 0-1
  pctCat1Promedio: number;
}

export function overview(muestras: Muestra[]): OverviewStats {
  const n = muestras.length;
  if (n === 0)
    return {
      totalMuestras: 0,
      totalClamshells: 0,
      totalBayas: 0,
      pctCumplimiento: 0,
      pctDescartePromedio: 0,
      pctCat1Promedio: 0,
    };

  let cumplen = 0;
  let bayas = 0;
  let descarte = 0;
  let cat1 = 0;
  let clams = 0;
  for (const m of muestras) {
    const r = computeMuestra(m);
    if (r.cumple) cumplen++;
    bayas += r.totalBayas;
    descarte += r.pctDescarte;
    cat1 += r.pctCat1;
    clams += m.clamshells.length;
  }
  return {
    totalMuestras: n,
    totalClamshells: clams,
    totalBayas: bayas,
    pctCumplimiento: cumplen / n,
    pctDescartePromedio: descarte / n,
    pctCat1Promedio: cat1 / n,
  };
}

export interface EmpacadorRow {
  empacador: string;
  muestras: number;
  pctDescarte: number; // promedio 0-1
  pctCumplimiento: number; // 0-1
}

/** Rendimiento por empacador (equivalente al RPC rendimiento_empacador). */
export function porEmpacador(muestras: Muestra[]): EmpacadorRow[] {
  const map = new Map<string, { n: number; descarte: number; cumplen: number }>();
  for (const m of muestras) {
    const key = m.empacador || "(sin empacador)";
    const r = computeMuestra(m);
    const cur = map.get(key) || { n: 0, descarte: 0, cumplen: 0 };
    cur.n++;
    cur.descarte += r.pctDescarte;
    if (r.cumple) cur.cumplen++;
    map.set(key, cur);
  }
  return Array.from(map.entries())
    .map(([empacador, v]) => ({
      empacador,
      muestras: v.n,
      pctDescarte: v.descarte / v.n,
      pctCumplimiento: v.cumplen / v.n,
    }))
    .sort((a, b) => b.pctDescarte - a.pctDescarte);
}

export interface SemanaRow {
  semana: number;
  muestras: number;
  pctDescarte: number;
  pctCat1: number;
}

/** Tendencia semanal (equivalente al RPC rendimiento_semanal). */
export function porSemana(muestras: Muestra[]): SemanaRow[] {
  const map = new Map<number, { n: number; descarte: number; cat1: number }>();
  for (const m of muestras) {
    const sem = m.semana ?? 0;
    const r = computeMuestra(m);
    const cur = map.get(sem) || { n: 0, descarte: 0, cat1: 0 };
    cur.n++;
    cur.descarte += r.pctDescarte;
    cur.cat1 += r.pctCat1;
    map.set(sem, cur);
  }
  return Array.from(map.entries())
    .map(([semana, v]) => ({
      semana,
      muestras: v.n,
      pctDescarte: v.descarte / v.n,
      pctCat1: v.cat1 / v.n,
    }))
    .sort((a, b) => a.semana - b.semana);
}
