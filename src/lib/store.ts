/**
 * Estado global de sesión y conectividad (Zustand + persistencia ligera).
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SessionState {
  inspectorNombre: string;
  inspectorDni: string;
  nPlanta: number | null;
  setInspector: (nombre: string, dni: string) => void;
  setPlanta: (n: number | null) => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      inspectorNombre: "",
      inspectorDni: "",
      nPlanta: null,
      setInspector: (inspectorNombre, inspectorDni) => set({ inspectorNombre, inspectorDni }),
      setPlanta: (nPlanta) => set({ nPlanta }),
    }),
    { name: "arandanos-session" }
  )
);

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
