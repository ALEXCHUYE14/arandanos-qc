"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Leaf, LogIn, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

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
    <main className="flex min-h-[calc(100vh-1.75rem)] items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <header className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-lg bg-brand text-white">
            <Leaf className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-ink">Control de Calidad — Arándanos</h1>
          <p className="mt-1 text-sm text-muted">Iniciá sesión para continuar</p>
        </header>

        <Card>
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

        <p className="mt-6 text-center text-xs text-muted">
          ¿No tenés cuenta? Pedile a Jefatura de Calidad que te la cree desde el panel de
          administración.
        </p>
      </div>
    </main>
  );
}
