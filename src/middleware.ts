/**
 * Protección de rutas a nivel de servidor (Edge).
 *
 * - Si no hay backend configurado (`NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` vacíos)
 *   no hace nada: el sistema sigue funcionando 100% local, como hasta ahora.
 * - Si hay backend, exige sesión iniciada para cualquier ruta salvo /login.
 * - Restringe /dashboard (Jefatura de Calidad) a perfiles con rol "jefatura".
 *
 * Esto es una capa de UX (evita que un inspector llegue a una pantalla que no
 * le corresponde); la seguridad real de los datos la hacen las políticas RLS
 * en Supabase (ver supabase/schema.sql), no este archivo.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase-middleware";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createMiddlewareClient(req, res);
  if (!supabase) return res; // modo local sin backend: sin restricciones

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = req.nextUrl;
  const isLoginPage = pathname === "/login";

  if (!user && !isLoginPage) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isLoginPage) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user && pathname.startsWith("/dashboard")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("rol")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.rol !== "jefatura") {
      const url = req.nextUrl.clone();
      url.pathname = "/inspector";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return res;
}

export const config = {
  matcher: [
    // Todo excepto assets estáticos, íconos, manifest y el service worker.
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons/).*)",
  ],
};
