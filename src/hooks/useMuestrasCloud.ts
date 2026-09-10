"use client";

/**
 * Para Jefatura de Calidad: lee las muestras DIRECTO de Supabase, no del
 * caché local de este navegador. `useMuestras()` (dexie-react-hooks) solo
 * muestra lo que ya sincronizó a ESTE dispositivo puntual — si Jefatura abre
 * el dashboard en un celular nuevo, o un inspector recién subió algo que
 * todavía no bajó acá, con el caché local no se ve. Acá se lee la fuente de
 * verdad y se mantiene al día sola vía Realtime (Supabase ya tiene
 * `muestras`/`clamshells` en la publicación `supabase_realtime`, ver
 * supabase/schema.sql): cualquier alta/edición de cualquier inspector,
 * desde cualquier dispositivo, actualiza este dashboard sin recargar.
 *
 * En modo local (sin backend configurado) no hay nada que leer de la nube:
 * cae al mismo caché local que usa el resto de la app.
 */

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { rowToMuestra } from "@/lib/sync";
import { listMuestrasLocal } from "@/lib/db";
import type { Muestra } from "@/lib/types";

export interface MuestrasCloudState {
  data: Muestra[];
  loading: boolean;
  error: string | null;
  /** true si lo que se ve viene de Supabase en vivo; false = caché local (modo local o sin conexión inicial). */
  live: boolean;
}

export function useMuestrasCloud(): MuestrasCloudState {
  const local = useLiveQuery(() => listMuestrasLocal(), [], [] as Muestra[]);
  const [cloud, setCloud] = useState<Muestra[] | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);

  // Solo la PRIMERA carga debe prender el spinner — las siguientes (Realtime
  // en cada alta/edición de cualquier inspector) refrescan en silencio. Un
  // ref (no el estado `cloud`) para saberlo: el efecto de abajo corre una
  // sola vez ([] de deps) y load() se re-crea en cada llamada del Realtime,
  // así que un `cloud === null` leído del closure quedaba SIEMPRE en su
  // valor inicial (null) para ese cierre — nunca "veía" que ya se había
  // cargado — y volvía a prender el loading en cada evento en vivo, aunque
  // el dashboard ya tuviera datos en pantalla. El ref sí se actualiza.
  const primeraCargaRef = useRef(true);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    let active = true;

    async function load() {
      if (primeraCargaRef.current) setLoading(true);
      try {
        const [{ data: muestras, error: e1 }, { data: clamshells, error: e2 }] = await Promise.all([
          supabase!.from("muestras").select("*").order("updated_at", { ascending: false }),
          supabase!.from("clamshells").select("*"),
        ]);
        if (e1) throw e1;
        if (e2) throw e2;

        const byMuestra = new Map<string, any[]>();
        (clamshells || []).forEach((c: any) => {
          const arr = byMuestra.get(c.muestra_id) || [];
          arr.push(c);
          byMuestra.set(c.muestra_id, arr);
        });

        const mapped = (muestras || []).map((r: any) => rowToMuestra(r, byMuestra.get(r.id) || []));
        if (active) {
          setCloud(mapped);
          setError(null);
        }
      } catch (err) {
        console.error("[dashboard] error leyendo muestras de Supabase", err);
        if (active) setError("No se pudo leer del servidor — mostrando el último dato disponible.");
      } finally {
        if (active) setLoading(false);
        primeraCargaRef.current = false;
      }
    }

    load();

    const channel = supabase
      .channel("dashboard-muestras")
      .on("postgres_changes", { event: "*", schema: "public", table: "muestras" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "clamshells" }, load)
      .subscribe();

    return () => {
      active = false;
      supabase!.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isSupabaseConfigured) {
    return { data: local ?? [], loading: false, error: null, live: false };
  }
  return { data: cloud ?? local ?? [], loading: loading && cloud === null, error, live: cloud !== null };
}
