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
import { todayISO, isoWeek, nowHHMM } from "@/lib/utils";
import type { Muestra } from "@/lib/types";
import { useSession, useAuth, extraerGrupoEspecificaciones } from "@/lib/store";

/**
 * Aislamiento por usuario: cada inspector solo ve (y por lo tanto solo
 * puede listar/editar/eliminar desde la UI) las muestras que ÉL creó —
 * antes, en un dispositivo compartido entre turnos, se veían mezcladas las
 * de todos los inspectores que hubieran usado ESE celular/tablet puntual
 * (IndexedDB es local al dispositivo, no por usuario). Se filtra por
 * `createdBy` (el uid de auth.uid(), el mismo que ya usan las políticas RLS
 * del lado del servidor — ver supabase/schema.sql). Sin login (modo local/
 * demo, sin backend configurado) no hay un usuario real que filtrar, así
 * que se sigue mostrando todo, igual que siempre en ese modo — el
 * aislamiento es un requisito de uso multi-inspector con backend, no del
 * modo de prueba local.
 */
export function useMuestras() {
  const userId = useAuth((s) => s.userId);
  return useLiveQuery(
    async () => {
      const all = await listMuestrasLocal();
      return userId ? all.filter((m) => m.createdBy === userId) : all;
    },
    [userId],
    [] as Muestra[]
  );
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
  // Grupo de especificaciones activo (ver lib/store.ts): si hay uno, la
  // muestra nueva arranca con Cliente/Destino/Variedad/etc. ya cargados,
  // así el inspector no tiene que repetirlos para cada empacador
  // consecutivo — solo carga Personal (Inspector/Empacador/DNI) y la
  // evaluación (clamshells). Si no hay grupo activo (recién "Cambiar
  // especificaciones", o primera muestra del día), arranca en blanco como
  // siempre.
  const grupo = session.grupoEspecificaciones;

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
    // Automático al crear (hora real de inicio de la evaluación); el
    // inspector puede corregirla a mano si empieza a cargar más tarde de lo
    // que efectivamente evaluó.
    horaEvaluacion: nowHHMM(),
    fechaCosecha: todayISO(),
    fechaEmpaque: todayISO(),
    plantaEmpaque: grupo?.plantaEmpaque ?? session.plantaEmpaque,
    linea: grupo?.linea ?? "",
    turno: grupo?.turno ?? "DÍA",
    productor: grupo?.productor ?? "",
    cliente: grupo?.cliente ?? "",
    destino: grupo?.destino ?? "",
    variedad: grupo?.variedad ?? "",
    formato: grupo?.formato ?? "",
    tipoEmpaque: grupo?.tipoEmpaque ?? "",
    calibre: grupo?.calibre ?? "",
    embalajeCaja: grupo?.embalajeCaja ?? "",
    embalajeClamshell: grupo?.embalajeClamshell ?? "",
    intervaloCosecha: grupo?.intervaloCosecha ?? "",
    dniInspector: inspectorDni,
    inspector: inspectorNombre,
    supervisor: "",
    dniEmpacador: "",
    empacador: "",
    pesoEstablecido: grupo?.pesoEstablecido ?? null,
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
  // Mantiene el "grupo de especificaciones" siempre al día con lo último
  // editado (ver createMuestra arriba y lib/store.ts) — así la PRÓXIMA
  // muestra nueva hereda estos mismos valores, sin que el inspector tenga
  // que "guardar" el grupo a mano en ningún lado. Se sobrescribe en cada
  // guardado a propósito (a diferencia del catálogo de sugerencias, acá SÍ
  // se quiere siempre la versión más reciente, no la primera).
  useSession.getState().setGrupoEspecificaciones(extraerGrupoEspecificaciones(m));
}

export async function removeMuestra(id: string): Promise<void> {
  await deleteMuestraLocal(id);
}

export { db };
