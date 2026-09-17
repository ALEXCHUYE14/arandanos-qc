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
    // Registro del Service Worker (PWA offline) + actualización automática.
    //
    // Bug real reportado varias veces ("no veo los cambios", en el celular
    // Y en la PC): un dispositivo que ya tenía la app abierta podía quedar
    // corriendo una versión vieja del código de forma indefinida — el
    // navegador solo revisa si hay una versión nueva de sw.js de tanto en
    // tanto, y aunque la detectara y la activara sola (public/sw.js ya usa
    // self.skipWaiting() + clients.claim(), así que SÍ toma control casi de
    // inmediato), nada forzaba a la pestaña ABIERTA a usar esa versión
    // nueva — solo se veía al cerrar la app del todo y volver a abrirla a
    // mano, lo que daba la falsa impresión de que ninguna corrección
    // llegaba nunca.
    //
    // Acá se pide explícitamente revisar si hay una versión nueva (algunos
    // navegadores son perezosos para chequearlo solos) y, si el navegador
    // efectivamente cambia de Service Worker CONTROLADOR mientras esta
    // pestaña ya estaba abierta (una actualización real, no la primera
    // instalación), se recarga la página una sola vez — así el usuario
    // siempre ve la versión más reciente sin tener que hacer nada. Si hay
    // una edición sin guardar en curso (ej. un clamshell a medio tipear),
    // el flush de "pagehide" (ver muestra/[id]/page.tsx) corre igual justo
    // antes de que la recarga navegue afuera — no se pierde nada.
    let intervaloChequeoSW: ReturnType<typeof setInterval> | null = null;
    if ("serviceWorker" in navigator) {
      const yaHabiaControlador = Boolean(navigator.serviceWorker.controller);
      let registro: ServiceWorkerRegistration | null = null;
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          registro = reg;
          reg.update().catch(() => {});
        })
        .catch(() => {});

      // Revisión periódica (no solo al abrir la app): un celular/PC que se
      // deja con la pestaña abierta durante horas (muy común — el
      // inspector no la cierra en toda la jornada) nunca volvía a chequear
      // por su cuenta si había una versión nueva, así que seguía corriendo
      // el código de la mañana todo el día. Cada 10 minutos alcanza — no
      // hace falta más seguido, y evita gastar batería/datos de más.
      intervaloChequeoSW = setInterval(() => {
        registro?.update().catch(() => {});
      }, 10 * 60 * 1000);

      let recargando = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        // Si esta pestaña nunca tuvo un Service Worker controlándola (recién
        // se está instalando por primera vez), este mismo evento se dispara
        // igual al activarse — no es una actualización real (la página ya
        // se sirvió fresca en esta misma carga), así que no hace falta
        // recargar.
        if (!yaHabiaControlador || recargando) return;
        recargando = true;
        window.location.reload();
      });
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
      if (intervaloChequeoSW) clearInterval(intervaloChequeoSW);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
