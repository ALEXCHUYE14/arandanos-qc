/**
 * Cliente de Supabase (browser). Requiere las variables de entorno:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * Si no están configuradas, el cliente queda como `null` y la app funciona
 * 100% offline con IndexedDB (modo demo / campo sin backend).
 *
 * Usa `createBrowserClient` (@supabase/ssr) en vez de `createClient` directo:
 * persiste la sesión en cookies (no solo localStorage), lo que permite que
 * `middleware.ts` y los Server Components lean el mismo estado de auth.
 */

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anon);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createBrowserClient(url as string, anon as string, {
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null;
