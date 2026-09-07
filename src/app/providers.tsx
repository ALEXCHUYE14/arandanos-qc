"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNet } from "@/lib/store";
import { fullSync } from "@/lib/sync";
import { fixInspectorNameTypo } from "@/lib/db";
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
      await fullSync();
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

    // Corrección puntual de datos locales (ver lib/db.ts) antes de
    // sincronizar, para que si corrige algo, esa corrección sea lo que suba.
    fixInspectorNameTypo()
      .catch((e) => console.error("[fix] fixInspectorNameTypo", e))
      .finally(() => {
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
