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

    async function syncSession(userId: string | null) {
      if (!userId) {
        if (active) setAnonymous();
        return;
      }
      const profile = await loadProfile(userId);
      if (active) setAuth(userId, profile);
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
