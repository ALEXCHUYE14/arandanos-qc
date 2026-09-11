"use client";

/**
 * Detalle de un "Grupo de especificaciones" (carpeta): muestra sus
 * Especificaciones (de un vistazo, sin tener que volver a cargarlas) y la
 * lista de muestras ya agregadas dentro. "+ Nueva muestra" entra al grupo
 * (por si no era ya el activo) y crea una muestra que hereda sus specs —
 * el inspector solo completa Empacador/DNI/evaluación.
 */

import { useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, ClipboardList, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useGrupo, useMuestrasDeGrupo, createMuestra, entrarAGrupo, eliminarGrupo } from "@/hooks/useMuestras";
import { computeMuestra } from "@/lib/calc";
import { fmtDateUI } from "@/lib/utils";

export default function GrupoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const grupo = useGrupo(id);
  const muestras = useMuestrasDeGrupo(id) ?? [];
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Traba de verdad, no solo el estado `creando` (ver la explicación
  // completa en /inspector/grupo/nuevo/page.tsx): evita que un segundo toque
  // durante la navegación de salida dispare una segunda creación.
  const creandoRef = useRef(false);

  async function nueva() {
    if (creandoRef.current) return;
    creandoRef.current = true;
    setCreando(true);
    setError(null);
    try {
      entrarAGrupo(id); // por si el inspector venía de otro grupo/sin ninguno
      const m = await createMuestra();
      router.push(`/inspector/muestra/${m.id}`);
      // No se libera la traba a propósito: ya se está navegando afuera.
    } catch (err) {
      console.error("[Nueva muestra en grupo] no se pudo crear", err);
      setError("No se pudo crear la muestra. Probá de nuevo.");
      creandoRef.current = false;
      setCreando(false);
    }
  }

  // Eliminar este grupo desde su propia pantalla de detalle — no borra las
  // muestras ya cargadas dentro (ver eliminarGrupoLocal en lib/db.ts), y
  // vuelve a "Mis muestras" al terminar.
  const [confirmEliminar, setConfirmEliminar] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  async function eliminar() {
    if (!id) return;
    setEliminando(true);
    setErrorEliminar(null);
    try {
      await eliminarGrupo(id);
      router.push("/inspector");
    } catch (err) {
      console.error("[grupo] no se pudo eliminar", err);
      setErrorEliminar("No se pudo eliminar el grupo. Probá de nuevo.");
      setEliminando(false);
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
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href="/inspector" className="mb-1 flex items-center gap-1 text-xs text-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> Mis muestras
          </Link>
          <h1 className="truncate text-xl font-bold text-ink">{grupo.nombre}</h1>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 text-danger"
          onClick={() => {
            setErrorEliminar(null);
            setConfirmEliminar(true);
          }}
        >
          <Trash2 className="h-4 w-4" /> Eliminar grupo
        </Button>
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

      <ConfirmDialog
        open={confirmEliminar}
        title="¿Eliminar este grupo?"
        description={
          <>
            Se va a eliminar la carpeta <strong>{grupo.nombre}</strong>. Las{" "}
            <strong>{muestras.length}</strong> muestra(s) ya cargada(s) dentro NO se borran — quedan
            intactas en &quot;Todas mis muestras&quot;, cada una con su propia copia de las Especificaciones.
            {errorEliminar && (
              <p className="mt-3 rounded-md border border-danger/30 bg-danger/10 px-2.5 py-1.5 text-xs font-medium text-danger">
                {errorEliminar}
              </p>
            )}
          </>
        }
        confirmLabel="Sí, eliminar"
        busy={eliminando}
        onConfirm={eliminar}
        onCancel={() => setConfirmEliminar(false)}
      />
    </main>
  );
}
