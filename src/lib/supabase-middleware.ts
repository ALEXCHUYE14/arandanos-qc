/**
 * Cliente de Supabase para `middleware.ts` (Edge runtime).
 *
 * Distinto del cliente de navegador (`lib/supabase.ts`): este lee/escribe las
 * cookies de la request/response de Next para poder refrescar el token de
 * sesión en cada navegación y decidir redirects (login, rutas por rol) antes
 * de que la página se renderice.
 */

import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

export function createMiddlewareClient(req: NextRequest, res: NextResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;

  return createServerClient(url, anon, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (cookies) => {
        cookies.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options);
        });
      },
    },
  });
}
