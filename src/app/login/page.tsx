"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { LogIn, AlertCircle, ShieldCheck, LifeBuoy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// Soporte por WhatsApp (+51 924 996 961). El +51 va sin "+" ni espacios en
// el link de wa.me; el mensaje precargado se arma con encodeURIComponent acá
// mismo en vez de escribirlo ya codificado a mano, para no equivocar ningún
// carácter (tildes, ¿, etc.) en la URL.
const WHATSAPP_SOPORTE = `https://wa.me/51924996961?text=${encodeURIComponent(
  "Hola, necesito ayuda para acceder al sistema de Control de Calidad."
)}`;

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) {
      setError(
        authError.message === "Invalid login credentials"
          ? "Correo o contraseña incorrectos."
          : authError.message
      );
      return;
    }
    router.replace(params.get("next") || "/");
    router.refresh();
  }

  return (
    <main className="relative flex min-h-[calc(100vh-1.75rem)] items-center justify-center px-4 py-8">
      {/* Fondo a todo el ancho de la ventana. `fixed` (en vez de `absolute`)
          es a propósito: el layout raíz envuelve TODAS las páginas en un
          contenedor centrado `max-w-6xl` (para que /inspector y /dashboard
          no queden edge-to-edge en pantallas anchas). `fixed` saca a este
          fondo de esa caja y lo ancla directo al viewport, sin tocar el
          layout raíz ni afectar ninguna otra pantalla. Overlay oscuro encima
          para que el texto y la tarjeta mantengan buen contraste sin
          importar qué zona de la foto quede detrás. */}
      <div className="fixed inset-0" aria-hidden="true">
        <Image src="/img/fondo.jpg" alt="" fill priority className="object-cover object-center" />
      </div>
      <div className="fixed inset-0 bg-ink/65" aria-hidden="true" />

      <div className="relative z-10 w-full max-w-sm animate-fade-in">
        <header className="mb-5 text-center">
          <Image
            src="/img/logo.jpg"
            alt="Berry Harvest"
            width={1136}
            height={943}
            priority
            className="mx-auto mb-3 h-24 w-auto rounded-lg bg-white p-1.5 shadow-lg"
          />
          <h1 className="text-xl font-bold text-white drop-shadow-sm">Control de Calidad — Arándanos</h1>
          <p className="mt-1 text-sm text-white/85 drop-shadow-sm">Iniciá sesión para continuar</p>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
            <ShieldCheck className="h-3.5 w-3.5" />
            Acceso exclusivo del personal autorizado
          </span>
        </header>

        <Card className="shadow-xl">
          <CardContent className="p-6">
            {!isSupabaseConfigured ? (
              <p className="text-sm text-muted">
                Este entorno corre en modo local (sin backend configurado): no requiere inicio de
                sesión. Cerrá esta página y usá el sistema normalmente.
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Correo</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nombre@empresa.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-md border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  <LogIn className="h-4 w-4" />
                  {loading ? "Ingresando…" : "Ingresar"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 space-y-2 text-center text-xs text-white/85 drop-shadow-sm">
          <p>
            ¿No tenés cuenta? Pedile al Coordinador de Calidad que te la cree desde el panel de
            administración.
          </p>
          <p className="flex items-center justify-center gap-1.5 text-white/70">
            <LifeBuoy className="h-3.5 w-3.5 shrink-0" />
            ¿Problemas para acceder?{" "}
            <a
              href={WHATSAPP_SOPORTE}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-white underline underline-offset-2 hover:text-white/90"
            >
              Contactar soporte
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
