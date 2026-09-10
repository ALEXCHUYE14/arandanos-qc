/**
 * Crea una cuenta nueva (correo + contraseña) para un inspector/coordinador.
 *
 * Por qué un endpoint de servidor y no una llamada directa desde el
 * navegador: crear un usuario de Supabase Auth requiere la Admin API
 * (auth.admin.createUser), que solo funciona con la "service role key" — una
 * clave con permisos totales que JAMÁS debe llegar al navegador (si el
 * cliente la tuviera, cualquiera podría crear cuentas o leer cualquier dato
 * saltándose RLS). Por eso este archivo vive en el servidor (Route Handler,
 * nunca se manda al bundle del navegador) y la clave se lee de una variable
 * de entorno SIN el prefijo NEXT_PUBLIC_ (esas sí viajan al navegador).
 *
 * Antes de usar la service role key, este endpoint verifica con la SESIÓN
 * PROPIA de quien llama (sus cookies, la misma que ya usa el resto de la
 * app) que sea jefatura — igual que decide cualquier política RLS. La
 * service role key nunca se usa para decidir "quién puede llamar esto", solo
 * para la operación puntual que la app anónima no puede hacer.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anon) {
    return NextResponse.json({ error: "Backend no configurado en este entorno." }, { status: 503 });
  }
  if (!serviceRole) {
    return NextResponse.json(
      {
        error:
          "Falta configurar SUPABASE_SERVICE_ROLE_KEY en las variables de entorno del servidor (Vercel → Settings → Environment Variables). Se consigue en Supabase → Project Settings → API → service_role.",
      },
      { status: 500 }
    );
  }

  // 1) ¿Quién llama? Con SU PROPIA sesión (cookies), no con la service role.
  const cookieStore = await cookies();
  const supabaseUser = createServerClient(url, anon, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      // Un Route Handler de API no necesita refrescar cookies de sesión en
      // la respuesta (a diferencia de middleware.ts, que sí navega páginas).
      setAll: () => {},
    },
  });
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { data: perfil } = await supabaseUser.from("profiles").select("rol").eq("id", user.id).maybeSingle();
  if (perfil?.rol !== "jefatura") {
    return NextResponse.json(
      { error: "Solo el Coordinador de Calidad puede crear cuentas nuevas." },
      { status: 403 }
    );
  }

  // 2) Ya verificado que quien llama es jefatura: recién ahora se usa la
  // service role, solo para lo puntual que la app anónima no puede hacer.
  const body = await req.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  const nombre = String(body?.nombre || "").trim();
  const dni = String(body?.dni || "").trim();
  const rol = body?.rol === "jefatura" ? "jefatura" : "inspector";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Correo inválido." }, { status: 400 });
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 });
  }

  const admin = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // no depende de que llegue un correo de confirmación
    user_metadata: { nombre },
  });
  if (createError || !created.user) {
    const msg = createError?.message || "No se pudo crear la cuenta.";
    // Mensaje más claro para el caso más común (correo ya usado).
    const friendly = /already.*registered|already.*exists/i.test(msg)
      ? "Ya existe una cuenta con ese correo."
      : msg;
    return NextResponse.json({ error: friendly }, { status: 400 });
  }

  // handle_new_user() (trigger en supabase/schema.sql) ya insertó la fila en
  // profiles con rol "inspector" por defecto apenas se creó el usuario —
  // acá se completa con el nombre/DNI/rol reales que se cargaron en el
  // formulario. Se reintenta una vez tras una pequeña espera por si el
  // trigger todavía no terminó de correr (async en Postgres).
  async function actualizarPerfil() {
    return admin.from("profiles").update({ nombre, dni, rol }).eq("id", created!.user!.id);
  }
  let { error: updateError } = await actualizarPerfil();
  if (updateError) {
    await new Promise((r) => setTimeout(r, 400));
    ({ error: updateError } = await actualizarPerfil());
  }
  if (updateError) {
    return NextResponse.json(
      {
        error: `La cuenta se creó (ya puede iniciar sesión) pero no se pudo completar nombre/DNI/rol automáticamente: ${updateError.message}. Se puede corregir a mano en la lista de usuarios.`,
      },
      { status: 207 }
    );
  }

  return NextResponse.json({ ok: true, id: created.user.id });
}
