"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, UserPlus, RefreshCw, Dices, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/store";

interface PerfilRow {
  id: string;
  nombre: string;
  dni: string;
  rol: "inspector" | "jefatura";
  created_at: string;
}

/** Contraseña temporal legible (sin caracteres ambiguos como 0/O, 1/l). */
function generarPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/**
 * Panel de administración de usuarios — solo Coordinador de Calidad
 * (protegido por middleware.ts, igual que el resto de /dashboard).
 *
 * Crea cuentas nuevas (correo + contraseña) llamando a
 * /api/admin/crear-usuario (necesita la service role key en el servidor —
 * ver ese archivo) y permite cambiar el rol de una cuenta ya existente
 * directamente contra Supabase (RLS ya le permite a jefatura editar
 * cualquier perfil, ver supabase/schema.sql → profiles_update).
 */
export default function UsuariosPage() {
  const miPerfil = useAuth((s) => s.profile);
  const [perfiles, setPerfiles] = useState<PerfilRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorLista, setErrorLista] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [dni, setDni] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(generarPassword());
  const [rol, setRol] = useState<"inspector" | "jefatura">("inspector");
  const [creando, setCreando] = useState(false);
  const [errorCrear, setErrorCrear] = useState<string | null>(null);
  const [creado, setCreado] = useState<{ email: string; password: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  const [cambiandoRolId, setCambiandoRolId] = useState<string | null>(null);

  async function cargarPerfiles() {
    if (!supabase) return;
    setCargando(true);
    setErrorLista(null);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nombre, dni, rol, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      setErrorLista("No se pudo cargar la lista de usuarios.");
    } else {
      setPerfiles((data || []) as PerfilRow[]);
    }
    setCargando(false);
  }

  useEffect(() => {
    cargarPerfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function crearUsuario(e: React.FormEvent) {
    e.preventDefault();
    setCreando(true);
    setErrorCrear(null);
    setCreado(null);
    try {
      const {
        data: { session },
      } = await supabase!.auth.getSession();
      const res = await fetch("/api/admin/crear-usuario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // El endpoint igual valida con las cookies de sesión — este header
        // no reemplaza esa validación, pero algunos proxies/entornos no
        // reenvían cookies en fetch same-origin sin credentials explícito.
        body: JSON.stringify({ nombre, dni, email, password, rol }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorCrear(data?.error || `Error ${res.status} al crear la cuenta.`);
        return;
      }
      setCreado({ email, password });
      setNombre("");
      setDni("");
      setEmail("");
      setPassword(generarPassword());
      setRol("inspector");
      await cargarPerfiles();
      void session; // (solo para dejar explícito que no hace falta reenviarlo a mano)
    } catch (err) {
      console.error("[usuarios] error creando cuenta", err);
      setErrorCrear("No se pudo conectar con el servidor. Probá de nuevo.");
    } finally {
      setCreando(false);
    }
  }

  async function cambiarRol(id: string, nuevoRol: "inspector" | "jefatura") {
    if (!supabase) return;
    setCambiandoRolId(id);
    try {
      const { error } = await supabase.from("profiles").update({ rol: nuevoRol }).eq("id", id);
      if (error) throw error;
      setPerfiles((prev) => prev.map((p) => (p.id === id ? { ...p, rol: nuevoRol } : p)));
    } catch (err) {
      console.error("[usuarios] no se pudo cambiar el rol", err);
      alert("No se pudo cambiar el rol de este usuario.");
    } finally {
      setCambiandoRolId(null);
    }
  }

  async function copiarCredenciales() {
    if (!creado) return;
    await navigator.clipboard.writeText(`Correo: ${creado.email}\nContraseña: ${creado.password}`);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="px-4 py-10 text-center text-sm text-muted">
        Este entorno corre en modo local (sin backend) — la administración de usuarios necesita
        Supabase configurado.
      </main>
    );
  }

  return (
    <main className="px-4 py-5">
      <div className="mb-4">
        <Link href="/dashboard" className="mb-1 flex items-center gap-1 text-xs text-muted hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Panel de Coordinador de Calidad
        </Link>
        <h1 className="text-xl font-bold text-ink">Usuarios</h1>
        <p className="text-xs text-muted">
          Crear cuentas nuevas (correo + contraseña) y asignar el rol de cada persona.
        </p>
      </div>

      {/* Alta de usuario */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink">Crear cuenta nueva</h2>
          <form onSubmit={crearUsuario} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <Label>Nombre completo</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Betsy Crisanto Valdiviezo" />
            </div>
            <div>
              <Label>DNI (opcional)</Label>
              <Input value={dni} onChange={(e) => setDni(e.target.value)} inputMode="numeric" />
            </div>
            <div className="sm:col-span-2">
              <Label>Correo</Label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@empresa.com"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Contraseña temporal</Label>
              <div className="flex gap-1.5">
                <Input value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Generar otra"
                  onClick={() => setPassword(generarPassword())}
                >
                  <Dices className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label>Rol</Label>
              <Select value={rol} onChange={(e) => setRol(e.target.value as "inspector" | "jefatura")}>
                <option value="inspector">Inspector Calidad línea</option>
                <option value="jefatura">Coordinador de Calidad</option>
              </Select>
            </div>
            <div className="flex items-end sm:col-span-1">
              <Button type="submit" className="w-full" disabled={creando}>
                <UserPlus className="h-4 w-4" /> {creando ? "Creando…" : "Crear cuenta"}
              </Button>
            </div>
          </form>

          {errorCrear && (
            <p className="mt-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
              {errorCrear}
            </p>
          )}

          {creado && (
            <div className="mt-3 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs text-ink">
              <p className="mb-1 font-semibold text-success">
                Cuenta creada — pasale estos datos a la persona (no se vuelven a mostrar):
              </p>
              <p>
                Correo: <span className="font-mono font-semibold">{creado.email}</span>
                <br />
                Contraseña: <span className="font-mono font-semibold">{creado.password}</span>
              </p>
              <Button variant="outline" size="sm" className="mt-2" onClick={copiarCredenciales}>
                {copiado ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                {copiado ? "Copiado" : "Copiar"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de usuarios */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-line p-3">
            <h2 className="text-sm font-semibold text-ink">Cuentas existentes</h2>
            <Button variant="ghost" size="sm" onClick={cargarPerfiles} disabled={cargando}>
              <RefreshCw className={`h-4 w-4 ${cargando ? "animate-spin" : ""}`} /> Actualizar
            </Button>
          </div>
          {errorLista && <p className="p-3 text-sm text-danger">{errorLista}</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-base text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">DNI</th>
                  <th className="px-3 py-2">Rol</th>
                </tr>
              </thead>
              <tbody>
                {perfiles.map((p) => (
                  <tr key={p.id} className="border-b border-line/60">
                    <td className="px-3 py-2">
                      {p.nombre || "—"}
                      {p.id === miPerfil?.id && <Badge variant="success" className="ml-1.5">vos</Badge>}
                    </td>
                    <td className="px-3 py-2">{p.dni || "—"}</td>
                    <td className="px-3 py-2">
                      <Select
                        value={p.rol}
                        disabled={cambiandoRolId === p.id}
                        onChange={(e) => cambiarRol(p.id, e.target.value as "inspector" | "jefatura")}
                        className="h-8 py-1 text-xs"
                      >
                        <option value="inspector">Inspector Calidad línea</option>
                        <option value="jefatura">Coordinador de Calidad</option>
                      </Select>
                    </td>
                  </tr>
                ))}
                {!cargando && perfiles.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-8 text-center text-sm text-muted">
                      Todavía no hay usuarios.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
