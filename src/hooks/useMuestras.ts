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
import { useSession } from "@/lib/store";

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

  const m: Muestra = {
    id,
    codigo: makeCodigo(seq),
    idMaestro: seq,
    semana: isoWeek(),
    fechaCosecha: todayISO(),
    fechaEmpaque: todayISO(),
    nPlanta: session.nPlanta,
    linea: "",
    turno: "DÍA",
    productor: "",
    cliente: "",
    destino: "",
    formato: "",
    calibre: "",
    embalajeCaja: "",
    embalajeClamshell: "",
    variedad: "",
    intervaloCosecha: "",
    dniInspector: session.inspectorDni,
    inspector: session.inspectorNombre,
    supervisor: "",
    dniEmpacador: "",
    empacador: "",
    pesoEstablecido: null,
    medidaCorrectiva: "NO",
    observaciones: "",
    clamshells: [emptyClamshell(id, 1)],
    createdAt: now,
    updatedAt: now,
    createdBy: session.inspectorNombre || "inspector",
    sync: "pending",
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
