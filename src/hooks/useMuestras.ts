"use client";

/**
 * Hooks de acceso a datos. Usa dexie-react-hooks (useLiveQuery) para
 * reactividad local instantánea offline, y expone helpers de creación/edición.
 */

import { useLiveQuery } from "dexie-react-hooks";
import {
  db,
  listMuestrasLocal,
  getMuestraLocal,
  saveMuestraLocal,
  deleteMuestraLocal,
  nextSeq,
  getCatalogo,
} from "@/lib/db";
import { makeCodigo, emptyClamshell } from "@/lib/calc";
import { todayISO, isoWeek } from "@/lib/utils";
import type { Muestra } from "@/lib/types";
import { useSession, useAuth } from "@/lib/store";

export function useMuestras() {
  return useLiveQuery(() => listMuestrasLocal(), [], [] as Muestra[]);
}

export function useMuestra(id: string | undefined) {
  return useLiveQuery(() => (id ? getMuestraLocal(id) : undefined), [id]);
}

export function useCatalogo(tipo: string) {
  return useLiveQuery(() => getCatalogo(tipo), [tipo], []);
}

/** Crea una nueva muestra en blanco con un clamshell inicial. */
export async function createMuestra(partial?: Partial<Muestra>): Promise<Muestra> {
  const seq = await nextSeq("muestra");
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const session = useSession.getState();
  const auth = useAuth.getState();
  // Con backend + login: el inspector y su DNI vienen del perfil autenticado
  // (más confiable que el campo de texto libre de useSession, que además es
  // el que se usaba antes para "created_by" y nunca calzaba con las políticas
  // RLS, pensadas para comparar contra el UUID de auth.uid()).
  const inspectorNombre = auth.profile?.nombre || session.inspectorNombre;
  const inspectorDni = auth.profile?.dni || session.inspectorDni;

  const m: Muestra = {
    id,
    // Provisorio: es un correlativo LOCAL (por dispositivo), solo para tener
    // algo que mostrar mientras no hay señal. Si hay backend configurado, el
    // servidor asigna el ID/código real (nunca repetido entre dispositivos)
    // en el primer sync exitoso y reemplaza esto — ver upsert_muestra_full
    // en supabase/schema.sql y pushOne en lib/sync.ts.
    codigo: makeCodigo(seq),
    idMaestro: seq,
    semana: isoWeek(),
    horaEvaluacion: "",
    fechaCosecha: todayISO(),
    fechaEmpaque: todayISO(),
    nPlanta: session.nPlanta,
    linea: "",
    turno: "DÍA",
    productor: "",
    cliente: "",
    destino: "",
    variedad: "",
    formato: "",
    tipoEmpaque: "",
    calibre: "",
    embalajeCaja: "",
    embalajeClamshell: "",
    intervaloCosecha: "",
    dniInspector: inspectorDni,
    inspector: inspectorNombre,
    supervisor: "",
    dniEmpacador: "",
    empacador: "",
    pesoEstablecido: null,
    medidaCorrectiva: "NO",
    observaciones: "",
    clamshells: [emptyClamshell(id, 1)],
    createdAt: now,
    updatedAt: now,
    // El UUID de auth.uid() es lo que las políticas RLS comparan (ver
    // supabase_schema.sql: `created_by = auth.uid()::text`). En modo local
    // (sin login) cae al nombre de texto libre, igual que antes.
    createdBy: auth.userId || inspectorNombre || "inspector",
    sync: "pending",
    baseUpdatedAt: null,
    ...partial,
  };
  await saveMuestraLocal(m);
  return m;
}

export async function updateMuestra(m: Muestra): Promise<void> {
  await saveMuestraLocal(m);
}

export async function removeMuestra(id: string): Promise<void> {
  await deleteMuestraLocal(id);
}

export { db };
