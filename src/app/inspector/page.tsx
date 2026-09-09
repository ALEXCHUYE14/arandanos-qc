"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, ChevronRight, Home, ClipboardList, AlertTriangle, FileSpreadsheet, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useMuestras, createMuestra, removeMuestra } from "@/hooks/useMuestras";
import { computeMuestra } from "@/lib/calc";
import { fmtDateUI, todayISO } from "@/lib/utils";
import { downloadXlsx } from "@/lib/excel";
import { resolveConflictKeepLocal, resolveConflictUseServer } from "@/lib/sync";

export default function InspectorListPage() {
  const router = useRouter();
  const muestras = useMuestras() ?? [];
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [limpiando, setLimpiando] = useState(false);

  async function nueva() {
    const m = await createMuestra();
    router.push(`/inspector/muestra/${m.id}`);
  }

  /** Descarga TODAS las muestras de esta lista en un único Excel — antes
   *  solo se podía exportar una muestra a la vez (PNG/PDF individual desde
   *  el reporte). Reutiliza downloadXlsx(), la misma función que ya usa el
   *  panel del Coordinador de Calidad para su "Exportar XLSX". */
  function descargarTodo() {
    downloadXlsx(muestras, `Muestras_${todayISO()}.xlsx`);
  }

  /**
   * Limpia la lista de muestras de ESTE dispositivo (borrado local, con
   * confirmación explícita — ver el modal más abajo). Las muestras que ya
   * se sincronizaron siguen a salvo en el servidor (panel del Coordinador de
   * Calidad); si este dispositivo vuelve a sincronizar más adelante, podrían
   * volver a aparecer acá, porque esto NO las borra de Supabase — solo
   * "vacía" la vista local. Se avisa de esto en el propio modal para no
   * prometer más de lo que la acción realmente hace.
   */
  async function limpiarRegistros() {
    setLimpiando(true);
    try {
      await Promise.all(muestras.map((m) => removeMuestra(m.id)));
    } catch (e) {
      console.error("[limpiar registros] no se pudo borrar alguna muestra", e);
    } finally {
      setLimpiando(false);
      setConfirmOpen(false);
    }
  }

  async function keepLocal(id: string) {
    setResolvingId(id);
    try {
      await resolveConflictKeepLocal(id);
    } catch (e) {
      console.error("[conflicto] no se pudo conservar la versión local", e);
    } finally {
      setResolvingId(null);
    }
  }

  async function pickServerVersion(id: string) {
    setResolvingId(id);
    try {
      await resolveConflictUseServer(id);
    } catch (e) {
      console.error("[conflicto] no se pudo traer la versión del servidor", e);
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <main className="px-4 py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/" className="mb-1 flex items-center gap-1 text-xs text-muted hover:text-ink">
            <Home className="h-3.5 w-3.5" /> Inicio
          </Link>
          <h1 className="text-xl font-bold text-ink">Mis muestras</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {muestras.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={descargarTodo}>
                <FileSpreadsheet className="h-4 w-4" /> Descargar todo (Excel)
              </Button>
              <Button variant="outline" size="sm" className="text-danger" onClick={() => setConfirmOpen(true)}>
                <Trash2 className="h-4 w-4" /> Limpiar registros
              </Button>
            </>
          )}
          <Button onClick={nueva} size="lg">
            <Plus className="h-5 w-5" /> Nueva muestra
          </Button>
        </div>
      </div>

      {muestras.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ClipboardList className="h-10 w-10 text-muted" />
            <p className="text-sm text-muted">Aún no has registrado muestras.</p>
            <Button onClick={nueva}>
              <Plus className="h-4 w-4" /> Crear la primera
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {muestras.map((m) => {
            const r = computeMuestra(m);
            const enConflicto = m.sync === "conflict";
            return (
              <Card key={m.id} className="overflow-hidden transition-shadow hover:shadow-sm">
                <Link href={`/inspector/muestra/${m.id}`}>
                  <CardContent className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-ink">{m.codigo}</span>
                        <Badge variant={r.cumple ? "success" : "danger"}>
                          {r.cumple ? "CUMPLE" : "NO CUMPLE"}
                        </Badge>
                        {m.sync === "pending" && <Badge variant="warning">sin sincronizar</Badge>}
                        {enConflicto && <Badge variant="danger">conflicto de sincronización</Badge>}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {m.empacador || "Sin empacador"} · {m.variedad || "—"} ·{" "}
                        {fmtDateUI(m.fechaEmpaque)} · {m.clamshells.length} clamshell(s)
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted">Descarte</p>
                      <p className="text-sm font-bold text-danger">{(r.pctDescarte * 100).toFixed(1)}%</p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
                  </CardContent>
                </Link>

                {enConflicto && (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-danger/20 bg-danger/5 px-3 py-2">
                    <span className="flex items-center gap-1.5 text-xs text-danger">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      Esta muestra también se editó desde otro dispositivo. Elegí qué versión conservar.
                    </span>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={resolvingId === m.id}
                        onClick={() => keepLocal(m.id)}
                      >
                        Conservar la mía
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={resolvingId === m.id}
                        onClick={() => pickServerVersion(m.id)}
                      >
                        Usar la del servidor
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="¿Limpiar registros?"
        description={
          <>
            Se van a borrar las <strong>{muestras.length}</strong> muestra(s) de esta lista, en{" "}
            <strong>este dispositivo</strong>. Esta acción no se puede deshacer.
            <br />
            <br />
            Las que ya estén sincronizadas siguen a salvo en el servidor (panel del Coordinador de
            Calidad) — si este dispositivo vuelve a sincronizar, podrían volver a aparecer acá.
          </>
        }
        confirmLabel="Sí, limpiar"
        busy={limpiando}
        onConfirm={limpiarRegistros}
        onCancel={() => setConfirmOpen(false)}
      />
    </main>
  );
}
