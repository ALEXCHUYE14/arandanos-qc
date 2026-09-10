"use client";

/**
 * Sincroniza el estado de auth de Supabase con el store `useAuth`.
 * Se monta una única vez desde <Providers>. En modo local (sin backend
 * configurado) marca la sesión como "anonymous" de inmediato y no hace nada más.
 */

import { useEffect } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/store";
import type { AppUserProfile } from "@/lib/types";

async function loadProfile(userId: string): Promise<AppUserProfile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nombre, dni, rol")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as AppUserProfile;
}

export function useAuthSync() {
  const { setAuth, setAnonymous } = useAuth();

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setAnonymous();
      return;
    }

    let active = true;
    // Token de la llamada más reciente a syncSession. getSession() (al
    // montar) y onAuthStateChange (login/logout) pueden disparar syncSession
    // varias veces seguidas; cada una hace su propio await a loadProfile(),
    // así que no hay garantía de que resuelvan en el mismo orden en que se
    // llamaron. Sin este chequeo, un login seguido de un logout muy rápido
    // podía terminar con la sesión marcada como autenticada otra vez: el
    // loadProfile() del login (más lento) resolvía DESPUÉS del setAnonymous()
    // del logout y lo pisaba. Con el token, solo se aplica el resultado de
    // la llamada más nueva — una respuesta que quedó vieja mientras esperaba
    // se descarta en silencio, no pisa nada.
    let seq = 0;

    async function syncSession(userId: string | null) {
      const miTurno = ++seq;
      if (!userId) {
        if (active && miTurno === seq) setAnonymous();
        return;
      }
      const profile = await loadProfile(userId);
      if (active && miTurno === seq) setAuth(userId, profile);
    }

    supabase.auth.getSession().then(({ data }) => {
      syncSession(data.session?.user.id ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      syncSession(session?.user.id ?? null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
