/**
 * Estado global de sesión y conectividad (Zustand + persistencia ligera).
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppUserProfile } from "./types";

interface SessionState {
  inspectorNombre: string;
  inspectorDni: string;
  plantaEmpaque: string;
  /**
   * Id del "Grupo de especificaciones" (carpeta) activo — ver GrupoEntry en
   * lib/db.ts. Mientras hay uno activo, "Nueva muestra" hereda sus
   * Especificaciones (Cliente/Destino/Variedad/etc.), así el inspector solo
   * completa Empacador/DNI/evaluación. `null` = sin grupo activo, la
   * próxima muestra nueva arranca en blanco (tras "Cambiar especificaciones"
   * o al entrar por primera vez).
   */
  grupoActivoId: string | null;
  setInspector: (nombre: string, dni: string) => void;
  setPlantaEmpaque: (p: string) => void;
  setGrupoActivo: (id: string | null) => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      inspectorNombre: "",
      inspectorDni: "",
      plantaEmpaque: "",
      grupoActivoId: null,
      setInspector: (inspectorNombre, inspectorDni) => set({ inspectorNombre, inspectorDni }),
      setPlantaEmpaque: (plantaEmpaque) => set({ plantaEmpaque }),
      setGrupoActivo: (grupoActivoId) => set({ grupoActivoId }),
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
