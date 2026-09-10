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
import { useSession } from "@/lib/store";

export default function InspectorListPage() {
  const router = useRouter();
  const muestras = useMuestras() ?? [];
  // Grupo de especificaciones activo (ver lib/store.ts) — se actualiza solo
  // con cada muestra guardada, para no repetir Cliente/Destino/Variedad/etc.
  // en cada empacador consecutivo.
  const grupo = useSession((s) => s.grupoEspecificaciones);
  const limpiarGrupo = useSession((s) => s.setGrupoEspecificaciones);
  // Set (no un solo id): con más de una muestra en conflicto a la vez, un
  // solo `resolvingId` compartido hacía que resolver la B (mientras la A
  // todavía estaba en curso) reactivara por error el botón de A, permitiendo
  // un segundo clic sobre una resolución todavía en vuelo. Con un Set, cada
  // fila solo se deshabilita mientras SU PROPIA resolución está en curso.
  const [resolvingIds, setResolvingIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [limpiando, setLimpiando] = useState(false);
  const [errorLimpiar, setErrorLimpiar] = useState<string | null>(null);
  // "Nueva muestra" es 100% local (IndexedDB, nunca espera a la red) — pero
  // igual se protege con try/catch + un estado de "creando" que deshabilita
  // el botón mientras tanto: sin esto, un doble-toque accidental disparaba
  // createMuestra() dos veces (dos muestras en blanco), y si algo fallara
  // (ej. IndexedDB bloqueado por otra pestaña) no había ningún aviso — el
  // botón simplemente no parecía hacer nada.
  const [creandoMuestra, setCreandoMuestra] = useState(false);
  const [errorNueva, setErrorNueva] = useState<string | null>(null);

  async function nueva() {
    if (creandoMuestra) return;
    setCreandoMuestra(true);
    setErrorNueva(null);
    try {
      const m = await createMuestra();
      router.push(`/inspector/muestra/${m.id}`);
    } catch (err) {
      console.error("[Nueva muestra] no se pudo crear", err);
      setErrorNueva("No se pudo crear la muestra. Probá de nuevo.");
    } finally {
      setCreandoMuestra(false);
    }
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
   * confirmación explícita — ver el modal más abajo). Las que ya estaban
   * sincronizadas siguen a salvo en el servidor (panel del Coordinador de
   * Calidad) — esto NO las borra de Supabase, solo "vacía" la vista local.
   * A diferencia de antes, ya NO vuelven a aparecer solas en el próximo
   * sync automático: deleteMuestraLocal() (lib/db.ts) deja un "tombstone"
   * por cada una, y pullAll() (lib/sync.ts) lo respeta.
   */
  async function limpiarRegistros() {
    setLimpiando(true);
    setErrorLimpiar(null);
    // Promise.allSettled (no Promise.all): si UNA muestra falla al
    // borrarse, Promise.all habría cortado ahí, ocultando qué pasó con el
    // resto de los borrados que sí se habían disparado en paralelo, y el
    // modal se cerraba igual (por el finally) como si hubiera funcionado
    // todo. Ahora se espera a que terminen todas, se cuentan las que
    // fallaron y, si hubo alguna, el modal NO se cierra solo — se avisa y
    // se puede reintentar (solo quedan las que realmente no se borraron).
    const resultados = await Promise.allSettled(muestras.map((m) => removeMuestra(m.id)));
    const fallidas = resultados.filter((r) => r.status === "rejected").length;
    setLimpiando(false);
    if (fallidas > 0) {
      console.error(`[limpiar registros] fallaron ${fallidas} de ${muestras.length} borrados`);
      setErrorLimpiar(
        `No se pudieron borrar ${fallidas} de ${muestras.length} muestra(s). Se borraron las demás — probá de nuevo para las que quedan.`
      );
    } else {
      setConfirmOpen(false);
    }
  }

  function marcarResolviendo(id: string, resolviendo: boolean) {
    setResolvingIds((prev) => {
      const next = new Set(prev);
      if (resolviendo) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function keepLocal(id: string) {
    marcarResolviendo(id, true);
    try {
      await resolveConflictKeepLocal(id);
    } catch (e) {
      console.error("[conflicto] no se pudo conservar la versión local", e);
    } finally {
      marcarResolviendo(id, false);
    }
  }

  async function pickServerVersion(id: string) {
    marcarResolviendo(id, true);
    try {
      await resolveConflictUseServer(id);
    } catch (e) {
      console.error("[conflicto] no se pudo traer la versión del servidor", e);
    } finally {
      marcarResolviendo(id, false);
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
              <Button
                variant="outline"
                size="sm"
                className="text-danger"
                onClick={() => {
                  setErrorLimpiar(null);
                  setConfirmOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4" /> Limpiar registros
              </Button>
            </>
          )}
          <Button onClick={nueva} size="lg" disabled={creandoMuestra}>
            <Plus className="h-5 w-5" /> {creandoMuestra ? "Creando…" : "Nueva muestra"}
          </Button>
        </div>
      </div>

      {errorNueva && (
        <div className="mb-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
          {errorNueva}
        </div>
      )}

      {/* Grupo de especificaciones activo: Cliente/Destino/Variedad/etc. que
          va a heredar automáticamente la PRÓXIMA muestra nueva — así no hace
          falta repetirlos para cada empacador consecutivo (Pepito, Juanito,
          Lupe...). "Cambiar especificaciones" lo vacía: la siguiente muestra
          nueva arranca en blanco, y en cuanto se guarde con datos nuevos,
          ESOS pasan a ser el grupo activo (ver updateMuestra en
          hooks/useMuestras.ts) — no hace falta "guardar" el grupo a mano. */}
      {grupo && (grupo.cliente || grupo.destino || grupo.variedad || grupo.formato) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-brand/20 bg-brand-soft px-3 py-2 text-xs">
          <span className="text-ink">
            <strong>Especificaciones activas:</strong> {[grupo.cliente, grupo.destino, grupo.variedad, grupo.formato, grupo.calibre]
              .filter(Boolean)
              .join(" · ") || "—"}
          </span>
          <Button variant="ghost" size="sm" onClick={() => limpiarGrupo(null)}>
            Cambiar especificaciones
          </Button>
        </div>
      )}

      {muestras.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ClipboardList className="h-10 w-10 text-muted" />
            <p className="text-sm text-muted">Aún no has registrado muestras.</p>
            <Button onClick={nueva} disabled={creandoMuestra}>
              <Plus className="h-4 w-4" /> {creandoMuestra ? "Creando…" : "Crear la primera"}
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
                        disabled={resolvingIds.has(m.id)}
                        onClick={() => keepLocal(m.id)}
                      >
                        Conservar la mía
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={resolvingIds.has(m.id)}
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
            Calidad) — no se borran de ahí, solo de esta lista, y no van a volver a aparecer acá.
            {errorLimpiar && (
              <p className="mt-3 rounded-md border border-danger/30 bg-danger/10 px-2.5 py-1.5 text-xs font-medium text-danger">
                {errorLimpiar}
              </p>
            )}
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
