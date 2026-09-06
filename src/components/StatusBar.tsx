"use client";

import { Wifi, WifiOff, RefreshCw, CloudOff, LogOut } from "lucide-react";
import { useNet, useAuth } from "@/lib/store";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/** Barra fina superior con el estado de conexión, sincronización y sesión. */
export function StatusBar() {
  const { online, syncing } = useNet();
  const { status, profile } = useAuth();

  async function logout() {
    await supabase?.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="no-print sticky top-0 z-40 flex h-7 items-center justify-between gap-2 border-b border-line bg-surface/90 px-3 text-[11px] font-medium text-muted backdrop-blur">
      <div className="flex flex-1 items-center justify-center gap-2">
        {!isSupabaseConfigured ? (
          <span className="flex items-center gap-1 text-warning">
            <CloudOff className="h-3.5 w-3.5" /> Modo local (sin backend configurado)
          </span>
        ) : online ? (
          <span className={cn("flex items-center gap-1", syncing ? "text-brand" : "text-success")}>
            {syncing ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Sincronizando…
              </>
            ) : (
              <>
                <Wifi className="h-3.5 w-3.5" /> En línea
              </>
            )}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-warning">
            <WifiOff className="h-3.5 w-3.5" /> Sin conexión — guardando localmente
          </span>
        )}
      </div>

      {status === "authenticated" && (
        <button
          onClick={logout}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted hover:bg-base hover:text-ink"
          title="Cerrar sesión"
        >
          <span className="max-w-[10rem] truncate">{profile?.nombre || "Sesión activa"}</span>
          <LogOut className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
