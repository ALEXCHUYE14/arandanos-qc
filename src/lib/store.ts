/**
 * Estado global de sesión y conectividad (Zustand + persistencia ligera).
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppUserProfile, Muestra } from "./types";

/**
 * "Grupo de especificaciones" activo — para no repetir Cliente/Destino/
 * Variedad/Formato/etc. en cada muestra nueva cuando varios empacadores
 * consecutivos comparten la misma configuración (Pepito, Juanito, Lupe...).
 * Son SOLO los campos de especificación del lote/proceso — nunca Personal
 * (Inspector/Empacador/DNI) ni la evaluación (clamshells/observaciones):
 * esos sí cambian por muestra y no deben heredarse de la anterior.
 */
export interface GrupoEspecificaciones {
  cliente: string;
  destino: string;
  variedad: string;
  formato: string;
  tipoEmpaque: string;
  calibre: string;
  embalajeCaja: string;
  embalajeClamshell: string;
  pesoEstablecido: string | null;
  productor: string;
  plantaEmpaque: string;
  linea: string;
  intervaloCosecha: string;
  turno: Muestra["turno"];
}

/** Recorta una Muestra completa a solo sus campos de especificación. */
export function extraerGrupoEspecificaciones(m: Muestra): GrupoEspecificaciones {
  return {
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
  };
}

interface SessionState {
  inspectorNombre: string;
  inspectorDni: string;
  plantaEmpaque: string;
  /**
   * Grupo de especificaciones activo (ver GrupoEspecificaciones arriba) —
   * se actualiza solo, en cada guardado de una muestra (ver updateMuestra en
   * hooks/useMuestras.ts), para siempre reflejar la última especificación
   * usada. `null` = sin grupo activo (la próxima muestra nueva arranca en
   * blanco) — así queda tras "Cambiar especificaciones".
   */
  grupoEspecificaciones: GrupoEspecificaciones | null;
  setInspector: (nombre: string, dni: string) => void;
  setPlantaEmpaque: (p: string) => void;
  setGrupoEspecificaciones: (g: GrupoEspecificaciones | null) => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      inspectorNombre: "",
      inspectorDni: "",
      plantaEmpaque: "",
      grupoEspecificaciones: null,
      setInspector: (inspectorNombre, inspectorDni) => set({ inspectorNombre, inspectorDni }),
      setPlantaEmpaque: (plantaEmpaque) => set({ plantaEmpaque }),
      setGrupoEspecificaciones: (grupoEspecificaciones) => set({ grupoEspecificaciones }),
    }),
    { name: "arandanos-session" }
  )
);

/**
 * Sesión de autenticación (Supabase Auth). En modo local (sin backend
 * configurado) queda en estado "anonymous" para siempre y la app sigue
 * funcionando como antes, identificando al inspector vía `useSession`.
 */
interface AuthState {
  status: "loading" | "authenticated" | "anonymous";
  userId: string | null;
  profile: AppUserProfile | null;
  setAuth: (userId: string | null, profile: AppUserProfile | null) => void;
  setAnonymous: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  status: "loading",
  userId: null,
  profile: null,
  setAuth: (userId, profile) => set({ status: "authenticated", userId, profile }),
  setAnonymous: () => set({ status: "anonymous", userId: null, profile: null }),
}));

interface NetState {
  online: boolean;
  syncing: boolean;
  lastSync: string | null;
  setOnline: (v: boolean) => void;
  setSyncing: (v: boolean) => void;
  setLastSync: (v: string) => void;
}

export const useNet = create<NetState>((set) => ({
  online: typeof navigator !== "undefined" ? navigator.onLine : true,
  syncing: false,
  lastSync: null,
  setOnline: (online) => set({ online }),
  setSyncing: (syncing) => set({ syncing }),
  setLastSync: (lastSync) => set({ lastSync }),
}));
