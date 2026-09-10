"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNet } from "@/lib/store";
import { fullSync } from "@/lib/sync";
import { fixInspectorNameTypo, seedListaMaestra } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useAuthSync } from "@/hooks/useAuthSync";

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
      })
  );

  useAuthSync();
  const { setOnline, setSyncing, setLastSync } = useNet();
  const syncingRef = useRef(false);

  async function runSync() {
    if (!isSupabaseConfigured || syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      // Timeout de seguridad: si el fetch a Supabase se cuelga sin llegar a
      // responder (wifi inestable, portal cautivo, etc.) `fullSync()` nunca
      // resuelve NI rechaza — sin este límite, `syncingRef.current` quedaba
      // en `true` para siempre y el sync automático de cada 60s (más abajo)
      // dejaba de hacer nada hasta recargar la página entera, dando la
      // sensación de que la app "se congeló". Con el timeout, se corta a los
      // 20s, se marca como error (se reintenta en el próximo ciclo) y la UI
      // (Mis Muestras, que es 100% local/IndexedDB) nunca dependió de esto
      // para mostrar datos.
      await Promise.race([
        fullSync(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Tiempo de espera agotado (20s)")), 20_000)
        ),
      ]);
      setLastSync(new Date().toISOString());
    } catch (e) {
      console.error("[sync]", e);
    } finally {
      setSyncing(false);
      syncingRef.current = false;
    }
  }

  useEffect(() => {
    // Registro del Service Worker (PWA offline).
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const on = () => {
      setOnline(true);
      runSync();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);

    // Corrección puntual de datos locales + siembra de las listas
    // desplegables reales del cliente (ver lib/db.ts), antes de sincronizar
    // (para que si corrige algo, esa corrección sea lo que suba).
    Promise.all([
      fixInspectorNameTypo().catch((e) => console.error("[fix] fixInspectorNameTypo", e)),
      seedListaMaestra().catch((e) => console.error("[fix] seedListaMaestra", e)),
    ]).finally(() => {
      // Sincroniza al arrancar y luego cada 60s si hay conexión.
      runSync();
    });
    const iv = setInterval(() => {
      if (navigator.onLine) runSync();
    }, 60_000);

    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      clearInterval(iv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
