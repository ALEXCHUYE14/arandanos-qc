"use client";

import { Wifi, WifiOff, RefreshCw, CloudOff } from "lucide-react";
import { useNet } from "@/lib/store";
import { isSupabaseConfigured } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/** Barra fina superior con el estado de conexión y sincronización. */
export function StatusBar() {
  const { online, syncing } = useNet();

  return (
    <div className="no-print sticky top-0 z-40 flex h-7 items-center justify-center gap-2 border-b border-line bg-surface/90 px-3 text-[11px] font-medium text-muted backdrop-blur">
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
  );
}
