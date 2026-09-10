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
  crearGrupoLocal,
  listGruposLocal,
  getGrupoLocal,
  actualizarEspecificacionesGrupo,
} from "@/lib/db";
import { makeCodigo, emptyClamshell } from "@/lib/calc";
import { todayISO, isoWeek, nowHHMM } from "@/lib/utils";
import type { Muestra, GrupoEntry, GrupoEspecificaciones } from "@/lib/types";
import { useSession, useAuth } from "@/lib/store";

/**
 * ¿Este registro (muestra o grupo) es de este usuario? Usada por el
 * aislamiento por usuario de abajo. No compara SOLO por uid exacto — bug
 * real encontrado en producción (Betsy: "Mis muestras" se veía vacía con
 * muestras suyas ya cargadas): createdBy no siempre quedó igual al
 * auth.uid() actual en TODOS los registros (datos de antes de que la
 * autenticación quedara completamente cableada, o uno creado en el instante
 * justo en que la sesión todavía estaba resolviendo — auth.userId podía ser
 * null por una fracción de segundo). Comparar solo por uid exacto escondía
 * esos registros para siempre, aunque fueran 100% del mismo inspector. Por
 * eso también hace fallback por el NOMBRE del perfil autenticado — cubre
 * esos casos sin dejar de aislar entre inspectores realmente distintos.
 */
export function esDelUsuarioActual(
  registro: { createdBy: string; inspector?: string },
  userId: string | null,
  nombrePerfil: string | null
): boolean {
  if (!userId) return true; // sin sesión (modo local/demo): no se filtra
  if (registro.createdBy === userId) return true;
  if (nombrePerfil && (registro.createdBy === nombrePerfil || registro.inspector === nombrePerfil)) return true;
  return false;
}

/**
 * Aislamiento por usuario: cada inspector solo ve (y por lo tanto solo
 * puede listar/editar/eliminar desde la UI) las muestras que ÉL creó —
 * antes, en un dispositivo compartido entre turnos, se veían mezcladas las
 * de todos los inspectores que hubieran usado ESE celular/tablet puntual
 * (IndexedDB es local al dispositivo, no por usuario). Sin login (modo
 * local/demo, sin backend configurado) no hay un usuario real que filtrar,
 * así que se sigue mostrando todo, igual que siempre en ese modo.
 */
export function useMuestras() {
  const userId = useAuth((s) => s.userId);
  const nombrePerfil = useAuth((s) => s.profile?.nombre ?? null);
  return useLiveQuery(
    async () => {
      const all = await listMuestrasLocal();
      return all.filter((m) => esDelUsuarioActual(m, userId, nombrePerfil));
    },
    [userId, nombrePerfil],
    [] as Muestra[]
  );
}

export function useMuestra(id: string | undefined) {
  return useLiveQuery(() => (id ? getMuestraLocal(id) : undefined), [id]);
}

export function useCatalogo(tipo: string) {
  return useLiveQuery(() => getCatalogo(tipo), [tipo], []);
}

/**
 * Lista de "Grupos de especificaciones" (carpetas) de este usuario — mismo
 * aislamiento por usuario que useMuestras().
 */
export function useGrupos() {
  const userId = useAuth((s) => s.userId);
  const nombrePerfil = useAuth((s) => s.profile?.nombre ?? null);
  return useLiveQuery(
    async () => {
      const all = await listGruposLocal();
      return all.filter((g) => esDelUsuarioActual(g, userId, nombrePerfil));
    },
    [userId, nombrePerfil],
    [] as GrupoEntry[]
  );
}

export function useGrupo(id: string | undefined) {
  return useLiveQuery(() => (id ? getGrupoLocal(id) : undefined), [id]);
}

/** Las muestras (de este usuario) que pertenecen a un grupo puntual. */
export function useMuestrasDeGrupo(grupoId: string | undefined) {
  const userId = useAuth((s) => s.userId);
  const nombrePerfil = useAuth((s) => s.profile?.nombre ?? null);
  return useLiveQuery(
    async () => {
      if (!grupoId) return [] as Muestra[];
      const all = await listMuestrasLocal();
      return all.filter((m) => m.grupoId === grupoId && esDelUsuarioActual(m, userId, nombrePerfil));
    },
    [grupoId, userId, nombrePerfil],
    [] as Muestra[]
  );
}

/**
 * Crea un nuevo "Grupo de especificaciones" (carpeta) y lo deja como
 * activo — la próxima "Nueva muestra" hereda sus Especificaciones. Ver
 * GrupoEntry en lib/types.ts.
 */
export async function crearGrupoNuevo(especificaciones: GrupoEspecificaciones): Promise<GrupoEntry> {
  const auth = useAuth.getState();
  const session = useSession.getState();
  const createdBy = auth.userId || auth.profile?.nombre || session.inspectorNombre || "inspector";
  const grupo = await crearGrupoLocal(especificaciones, createdBy);
  useSession.getState().setGrupoActivo(grupo.id);
  return grupo;
}

/** Entra a un grupo YA EXISTENTE (lo marca como activo, sin crear uno nuevo). */
export function entrarAGrupo(id: string): void {
  useSession.getState().setGrupoActivo(id);
}

/** "Cambiar especificaciones": deja de haber grupo activo — la próxima
 *  muestra nueva (fuera de cualquier carpeta) arranca en blanco. */
export function salirDeGrupo(): void {
  useSession.getState().setGrupoActivo(null);
}

/**
 * Crea una nueva muestra en blanco con un clamshell inicial. Si hay un
 * "Grupo de especificaciones" activo (ver lib/store.ts), hereda sus
 * Especificaciones y queda etiquetada con `grupoId` — así el inspector solo
 * completa Empacador/DNI/evaluación para cada empacador consecutivo.
 */
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
  // Grupo de especificaciones activo: si hay uno, la muestra nueva arranca
  // con Cliente/Destino/Variedad/etc. ya cargados — solo se carga Personal
  // (Inspector/Empacador/DNI) y la evaluación (clamshells). Si no hay grupo
  // activo (recién "Cambiar especificaciones", o sin ninguno todavía),
  // arranca en blanco como siempre.
  const grupo = session.grupoActivoId ? await getGrupoLocal(session.grupoActivoId) : undefined;
  const specs = grupo?.especificaciones;

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
    plantaEmpaque: specs?.plantaEmpaque ?? session.plantaEmpaque,
    linea: specs?.linea ?? "",
    turno: specs?.turno ?? "DÍA",
    productor: specs?.productor ?? "",
    cliente: specs?.cliente ?? "",
    destino: specs?.destino ?? "",
    variedad: specs?.variedad ?? "",
    formato: specs?.formato ?? "",
    tipoEmpaque: specs?.tipoEmpaque ?? "",
    calibre: specs?.calibre ?? "",
    embalajeCaja: specs?.embalajeCaja ?? "",
    embalajeClamshell: specs?.embalajeClamshell ?? "",
    intervaloCosecha: specs?.intervaloCosecha ?? "",
    dniInspector: inspectorDni,
    inspector: inspectorNombre,
    supervisor: "",
    dniEmpacador: "",
    empacador: "",
    pesoEstablecido: specs?.pesoEstablecido ?? null,
    medidaCorrectiva: "NO",
    observaciones: "",
    notaManual: null,
    grupoId: grupo?.id ?? null,
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
  // Si esta muestra pertenece a un grupo (carpeta), sus Especificaciones
  // quedan como la versión más reciente del grupo — así, si el inspector
  // corrige a mano un campo de especificación acá, esa corrección también
  // aplica a la PRÓXIMA muestra que se cree en el mismo grupo. No hace
  // falta "guardar" el grupo a mano en ningún lado.
  if (m.grupoId) {
    await actualizarEspecificacionesGrupo(m.grupoId, {
      cliente: m.cliente,
      destino: m.destino,
      variedad: m.variedad,
      formato: m.formato,
      tipoEmpaque: m.tipoEmpaque,
      calibre: m.calibre,
      embalajeCaja: m.embalajeCaja,
      embalajeClamshell: m.embalajeClamshell,
      pesoEstablecido: m.pesoEstablecido,
      productor: m.productor,
      plantaEmpaque: m.plantaEmpaque,
      linea: m.linea,
      intervaloCosecha: m.intervaloCosecha,
      turno: m.turno,
    });
  }
}

export async function removeMuestra(id: string): Promise<void> {
  await deleteMuestraLocal(id);
}

export { db };
