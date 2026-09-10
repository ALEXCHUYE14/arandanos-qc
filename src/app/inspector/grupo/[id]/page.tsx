"use client";

/**
 * Detalle de un "Grupo de especificaciones" (carpeta): muestra sus
 * Especificaciones (de un vistazo, sin tener que volver a cargarlas) y la
 * lista de muestras ya agregadas dentro. "+ Nueva muestra" entra al grupo
 * (por si no era ya el activo) y crea una muestra que hereda sus specs —
 * el inspector solo completa Empacador/DNI/evaluación.
 */

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, ClipboardList, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useGrupo, useMuestrasDeGrupo, createMuestra, entrarAGrupo } from "@/hooks/useMuestras";
import { computeMuestra } from "@/lib/calc";
import { fmtDateUI } from "@/lib/utils";

export default function GrupoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const grupo = useGrupo(id);
  const muestras = useMuestrasDeGrupo(id) ?? [];
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function nueva() {
    if (creando) return;
    setCreando(true);
    setError(null);
    try {
      entrarAGrupo(id); // por si el inspector venía de otro grupo/sin ninguno
      const m = await createMuestra();
      router.push(`/inspector/muestra/${m.id}`);
    } catch (err) {
      console.error("[Nueva muestra en grupo] no se pudo crear", err);
      setError("No se pudo crear la muestra. Probá de nuevo.");
    } finally {
      setCreando(false);
    }
  }

  if (grupo === undefined) {
    return <main className="px-4 py-10 text-center text-sm text-muted">Cargando grupo…</main>;
  }
  if (!grupo) {
    return (
      <main className="px-4 py-10 text-center text-sm text-muted">
        Este grupo no existe (o no te pertenece).
        <br />
        <Link href="/inspector" className="mt-2 inline-block text-brand underline">
          Volver a Mis muestras
        </Link>
      </main>
    );
  }

  const specs = grupo.especificaciones;
  const resumenSpecs = [
    ["Cliente", specs.cliente],
    ["Destino", specs.destino],
    ["Variedad", specs.variedad],
    ["Formato", specs.formato],
    ["Tipo de empaque", specs.tipoEmpaque],
    ["Calibre", specs.calibre],
    ["Embalaje caja", specs.embalajeCaja],
    ["Etiqueta clamshell", specs.embalajeClamshell],
  ].filter(([, v]) => v);

  return (
    <main className="px-4 py-4 pb-24">
      <div className="mb-3">
        <Link href="/inspector" className="mb-1 flex items-center gap-1 text-xs text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Mis muestras
        </Link>
        <h1 className="text-xl font-bold text-ink">{grupo.nombre}</h1>
      </div>

      {resumenSpecs.length > 0 && (
        <Card className="mb-3">
          <CardContent className="grid grid-cols-2 gap-x-4 gap-y-1 p-3 text-xs sm:grid-cols-4">
            {resumenSpecs.map(([label, value]) => (
              <div key={label}>
                <span className="text-muted">{label}: </span>
                <span className="font-semibold text-ink">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="mb-3">
        <Button onClick={nueva} disabled={creando} size="lg" className="w-full">
          <Plus className="h-5 w-5" /> {creando ? "Creando…" : "Nueva muestra en este grupo"}
        </Button>
        {error && <p className="mt-2 text-xs font-medium text-danger">{error}</p>}
      </div>

      {muestras.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <ClipboardList className="h-9 w-9 text-muted" />
            <p className="text-sm text-muted">Todavía no hay muestras en este grupo.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {muestras.map((m) => {
            const r = computeMuestra(m);
            // Misma prioridad que en /inspector y en el reporte: la Nota
            // elegida a mano (notaManual) manda; null (sin definir, incluye
            // registros previos a este campo) cae al cálculo automático.
            const notaMostrada = m.notaManual ?? (r.cumple ? 15 : 5);
            return (
              <Link key={m.id} href={`/inspector/muestra/${m.id}`}>
                <Card className="overflow-hidden transition-shadow hover:shadow-sm">
                  <CardContent className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-ink">{m.codigo}</span>
                        <Badge variant={notaMostrada === 15 ? "success" : "danger"}>
                          Nota {notaMostrada}
                        </Badge>
                        {m.sync === "pending" && <Badge variant="warning">sin sincronizar</Badge>}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {m.empacador || "Sin empacador"} · {fmtDateUI(m.fechaEmpaque)} ·{" "}
                        {m.clamshells.length} clamshell(s)
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted">Descarte</p>
                      <p className="text-sm font-bold text-danger">{(r.pctDescarte * 100).toFixed(1)}%</p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
