"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, UserPlus, RefreshCw, Search, Ban, RotateCcw, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { syncEmpacadoresFromServer } from "@/lib/sync";
import { useAuth } from "@/lib/store";
import {
  parsearEmpacadoresXlsx,
  descargarEmpacadoresXlsx,
  type EmpacadorExcel,
} from "@/lib/empacadoresExcel";

/** Cuántas filas por pedido a Supabase en la importación (cada lote es un upsert por DNI). */
const LOTE_IMPORT = 200;

interface PreviewImport {
  nombreArchivo: string;
  filas: EmpacadorExcel[];
  errores: string[];
  tieneColumnaActivo: boolean;
  nuevos: number;
  actualizados: number;
}

interface EmpacadorRow {
  dni: string;
  nombre: string;
  activo: boolean;
  created_at: string;
}

const DNI_RE = /^[0-9]{6,12}$/;

/**
 * Administración de empacadores — solo Coordinador de Calidad (protegido
 * por middleware.ts, igual que el resto de /dashboard).
 *
 * Antes, agregar o dar de baja un empacador significaba que el desarrollador
 * editara lib/listaMaestra.ts a mano y redesplegara — el personal de línea
 * rota ~2 veces por semana, así que eso no escalaba. Ahora esta pantalla
 * escribe directo a la tabla public.empacadores (ver supabase/schema.sql),
 * y el cambio llega SOLO (sin redeploy) a todos los dispositivos de los
 * inspectores en el próximo sync automático (cada 60s, ver
 * syncEmpacadoresFromServer() en lib/sync.ts).
 *
 * Baja LÓGICA (nunca se borra la fila): "Dar de baja" solo deja de sugerir
 * a esa persona en el autocompletado — las muestras que YA se cargaron con
 * su nombre no se tocan (ese campo es texto libre, copiado en el momento).
 */
export default function EmpacadoresPage() {
  const perfil = useAuth((s) => s.profile);
  const [lista, setLista] = useState<EmpacadorRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorLista, setErrorLista] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("");

  const [nombre, setNombre] = useState("");
  const [dni, setDni] = useState("");
  const [creando, setCreando] = useState(false);
  const [errorCrear, setErrorCrear] = useState<string | null>(null);
  const [okCrear, setOkCrear] = useState<string | null>(null);

  const [cambiandoDni, setCambiandoDni] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<PreviewImport | null>(null);
  const [leyendoArchivo, setLeyendoArchivo] = useState(false);
  const [importando, setImportando] = useState(false);
  const [errorImport, setErrorImport] = useState<string | null>(null);
  const [okImport, setOkImport] = useState<string | null>(null);

  async function cargar() {
    if (!supabase) return;
    setCargando(true);
    setErrorLista(null);
    const { data, error } = await supabase
      .from("empacadores")
      .select("dni, nombre, activo, created_at")
      .order("nombre", { ascending: true });
    if (error) {
      setErrorLista("No se pudo cargar la lista de empacadores.");
    } else {
      setLista((data || []) as EmpacadorRow[]);
    }
    setCargando(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setErrorCrear(null);
    setOkCrear(null);

    const nombreLimpio = nombre.trim().toUpperCase();
    const dniLimpio = dni.trim();
    if (!nombreLimpio) {
      setErrorCrear("Ingresá el nombre completo.");
      return;
    }
    if (!DNI_RE.test(dniLimpio)) {
      setErrorCrear("El DNI debe tener solo números (6 a 12 dígitos).");
      return;
    }

    setCreando(true);
    try {
      const yaExiste = lista.find((e) => e.dni === dniLimpio);
      const { error } = await supabase
        .from("empacadores")
        .upsert(
          { dni: dniLimpio, nombre: nombreLimpio, activo: true, created_by: perfil?.id },
          { onConflict: "dni" }
        );
      if (error) throw error;
      setOkCrear(
        yaExiste
          ? `Se actualizó el nombre para el DNI ${dniLimpio} (ya existía).`
          : `Se agregó ${nombreLimpio}.`
      );
      setNombre("");
      setDni("");
      await cargar();
      // Refresca el catálogo de ESTE dispositivo de inmediato — no hace
      // falta esperar el próximo ciclo de 60s para verlo reflejado acá
      // mismo (los demás dispositivos sí lo ven en su propio próximo ciclo).
      syncEmpacadoresFromServer().catch((err) =>
        console.error("[empacadores] no se pudo refrescar el catálogo local", err)
      );
    } catch (err) {
      console.error("[empacadores] no se pudo guardar", err);
      setErrorCrear("No se pudo guardar. Probá de nuevo.");
    } finally {
      setCreando(false);
    }
  }

  async function toggleActivo(row: EmpacadorRow) {
    if (!supabase) return;
    setCambiandoDni(row.dni);
    try {
      const { error } = await supabase
        .from("empacadores")
        .update({ activo: !row.activo })
        .eq("dni", row.dni);
      if (error) throw error;
      setLista((prev) => prev.map((e) => (e.dni === row.dni ? { ...e, activo: !e.activo } : e)));
      syncEmpacadoresFromServer().catch((err) =>
        console.error("[empacadores] no se pudo refrescar el catálogo local", err)
      );
    } catch (err) {
      console.error("[empacadores] no se pudo cambiar el estado", err);
      alert("No se pudo cambiar el estado de este empacador.");
    } finally {
      setCambiandoDni(null);
    }
  }

  /** Paso 1 de la importación: lee y valida el archivo, NO escribe nada. */
  async function elegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo después
    if (!file) return;
    setPreview(null);
    setErrorImport(null);
    setOkImport(null);
    setLeyendoArchivo(true);
    try {
      const resultado = parsearEmpacadoresXlsx(await file.arrayBuffer());
      const dnisActuales = new Set(lista.map((x) => x.dni));
      const actualizados = resultado.filas.filter((f) => dnisActuales.has(f.dni)).length;
      setPreview({
        nombreArchivo: file.name,
        filas: resultado.filas,
        errores: resultado.errores,
        tieneColumnaActivo: resultado.tieneColumnaActivo,
        nuevos: resultado.filas.length - actualizados,
        actualizados,
      });
    } catch (err) {
      console.error("[empacadores] no se pudo leer el Excel", err);
      setErrorImport("No se pudo leer el archivo. Tiene que ser un Excel (.xlsx o .xls).");
    } finally {
      setLeyendoArchivo(false);
    }
  }

  /** Paso 2: solo al confirmar, se escribe en lotes (upsert por DNI — repetir el mismo archivo no duplica). */
  async function confirmarImport() {
    if (!supabase || !preview || preview.errores.length > 0 || preview.filas.length === 0) return;
    setImportando(true);
    setErrorImport(null);
    setOkImport(null);
    const total = preview.filas.length;
    let escritos = 0;
    try {
      const payload = preview.filas.map((f) => ({
        dni: f.dni,
        nombre: f.nombre,
        created_by: perfil?.id,
        // Si el archivo no trae ACTIVO, no se envía la columna: los que ya existen
        // conservan su estado; los nuevos entran como activos (default de la tabla).
        ...(preview.tieneColumnaActivo ? { activo: f.activo } : {}),
      }));
      for (let i = 0; i < payload.length; i += LOTE_IMPORT) {
        const lote = payload.slice(i, i + LOTE_IMPORT);
        const { error } = await supabase.from("empacadores").upsert(lote, { onConflict: "dni" });
        if (error) throw error;
        escritos += lote.length;
      }
      setOkImport(
        `Se importaron ${total} empacadores (${preview.nuevos} nuevos, ${preview.actualizados} actualizados).`
      );
      setPreview(null);
      await cargar();
      syncEmpacadoresFromServer().catch((err) =>
        console.error("[empacadores] no se pudo refrescar el catálogo local", err)
      );
    } catch (err) {
      console.error("[empacadores] importación interrumpida", err);
      setErrorImport(
        `Se interrumpió la importación: se guardaron ${escritos} de ${total}. Volvé a importar el mismo archivo — es seguro, no duplica nada.`
      );
      await cargar();
    } finally {
      setImportando(false);
    }
  }

  const filtrada = useMemo(() => {
    const q = filtro.trim().toUpperCase();
    if (!q) return lista;
    return lista.filter((e) => e.nombre.includes(q) || e.dni.includes(q));
  }, [filtro, lista]);

  const activos = lista.filter((e) => e.activo).length;

  if (!isSupabaseConfigured) {
    return (
      <main className="px-4 py-10 text-center text-sm text-muted">
        Este entorno corre en modo local (sin backend) — la administración de empacadores necesita
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
        <h1 className="text-xl font-bold text-ink">Empacadores</h1>
        <p className="text-xs text-muted">
          Agregar o dar de baja personal de línea — el cambio llega solo a los celulares de los
          inspectores en menos de un minuto, sin necesidad de tocar nada más.
        </p>
      </div>

      {/* Alta / actualización */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink">Agregar empacador</h2>
          <form onSubmit={agregar} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <Label>Nombre completo</Label>
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="APELLIDOS Y NOMBRES"
              />
            </div>
            <div>
              <Label>DNI</Label>
              <Input value={dni} onChange={(e) => setDni(e.target.value)} inputMode="numeric" placeholder="12345678" />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full" disabled={creando}>
                <UserPlus className="h-4 w-4" /> {creando ? "Guardando…" : "Agregar"}
              </Button>
            </div>
          </form>
          {/* Si el DNI ya existe, "Agregar" lo actualiza en vez de duplicarlo
              (dni es la llave primaria en Supabase — ver supabase/schema.sql)
              — sirve también para corregir un nombre mal escrito. */}
          {errorCrear && (
            <p className="mt-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
              {errorCrear}
            </p>
          )}
          {okCrear && (
            <p className="mt-3 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs font-medium text-success">
              {okCrear}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Importación desde Excel */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <h2 className="mb-1 text-sm font-semibold text-ink">Importar desde Excel</h2>
          <p className="mb-3 text-xs text-muted">
            Primera fila con los encabezados: <span className="font-mono">NOMBRE | DNI | ACTIVO</span>. DNI de 6 a 12
            números (formato Texto). ACTIVO es opcional: SI o NO (vacío = SI). Si un DNI ya existe, se actualiza su
            nombre. Podés usar &quot;Exportar&quot; para bajar la lista con esas mismas columnas y editarla.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={elegirArchivo}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={leyendoArchivo || importando}
            >
              <Upload className="h-4 w-4" /> {leyendoArchivo ? "Leyendo archivo…" : "Importar Excel"}
            </Button>
            <Button
              variant="outline"
              onClick={() => descargarEmpacadoresXlsx(lista)}
              disabled={cargando || lista.length === 0}
            >
              <Download className="h-4 w-4" /> Exportar Excel
            </Button>
          </div>

          {errorImport && (
            <p className="mt-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
              {errorImport}
            </p>
          )}
          {okImport && (
            <p className="mt-3 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs font-medium text-success">
              {okImport}
            </p>
          )}

          {preview && (
            <div className="mt-3 rounded-md border border-line p-3">
              <p className="text-xs font-semibold text-ink">Vista previa — {preview.nombreArchivo}</p>
              {preview.errores.length > 0 ? (
                <>
                  <p className="mt-1 text-xs font-medium text-danger">
                    No se importó nada. Corregí estos errores en el Excel y volvé a subirlo:
                  </p>
                  <ul className="mt-2 max-h-48 list-disc overflow-y-auto pl-5 text-xs text-danger">
                    {preview.errores.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <>
                  <p className="mt-1 text-xs text-ink">
                    Se van a cargar <b>{preview.filas.length}</b> empacadores: <b>{preview.nuevos}</b> nuevos y{" "}
                    <b>{preview.actualizados}</b> que ya existen (se actualiza su nombre
                    {preview.tieneColumnaActivo ? " y su estado ACTIVO" : ""}).
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button onClick={confirmarImport} disabled={importando}>
                      <Upload className="h-4 w-4" /> {importando ? "Importando…" : `Confirmar importación (${preview.filas.length})`}
                    </Button>
                    <Button variant="ghost" onClick={() => setPreview(null)} disabled={importando}>
                      Cancelar
                    </Button>
                  </div>
                </>
              )}
              {preview.errores.length > 0 && (
                <div className="mt-3">
                  <Button variant="ghost" size="sm" onClick={() => setPreview(null)}>
                    Cerrar
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista */}
      <Card>
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-3">
            <h2 className="text-sm font-semibold text-ink">
              Lista de empacadores <span className="font-normal text-muted">({activos} activos de {lista.length})</span>
            </h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                <Input
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  placeholder="Buscar por nombre o DNI…"
                  className="h-8 w-48 py-1 pl-7 text-xs"
                />
              </div>
              <Button variant="ghost" size="sm" onClick={cargar} disabled={cargando}>
                <RefreshCw className={`h-4 w-4 ${cargando ? "animate-spin" : ""}`} /> Actualizar
              </Button>
            </div>
          </div>
          {errorLista && <p className="p-3 text-sm text-danger">{errorLista}</p>}
          <div className="max-h-[60vh] overflow-y-auto overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 border-b border-line bg-base text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">DNI</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtrada.map((e) => (
                  <tr key={e.dni} className="border-b border-line/60">
                    <td className="px-3 py-2">{e.nombre}</td>
                    <td className="px-3 py-2 font-mono">{e.dni}</td>
                    <td className="px-3 py-2">
                      <Badge variant={e.activo ? "success" : "warning"}>
                        {e.activo ? "Activo" : "De baja"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={cambiandoDni === e.dni}
                        onClick={() => toggleActivo(e)}
                      >
                        {e.activo ? (
                          <>
                            <Ban className="h-3.5 w-3.5" /> Dar de baja
                          </>
                        ) : (
                          <>
                            <RotateCcw className="h-3.5 w-3.5" /> Reactivar
                          </>
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
                {!cargando && filtrada.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-sm text-muted">
                      {lista.length === 0 ? "Todavía no hay empacadores cargados." : "Sin resultados para ese filtro."}
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
