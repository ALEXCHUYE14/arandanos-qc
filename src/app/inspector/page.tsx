"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Plus, ChevronRight, Home, ClipboardList, AlertTriangle, FileSpreadsheet, Trash2, FolderPlus, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useMuestras, useGrupos, createMuestra, removeMuestra, eliminarGrupo } from "@/hooks/useMuestras";
import { computeMuestra } from "@/lib/calc";
import { fmtDateUI, todayISO } from "@/lib/utils";
import { downloadXlsx } from "@/lib/excel";
import { resolveConflictKeepLocal, resolveConflictUseServer } from "@/lib/sync";
import type { GrupoEntry } from "@/lib/types";

export default function InspectorListPage() {
  const router = useRouter();
  const muestras = useMuestras() ?? [];
  // Grupos de especificaciones ("carpetas") de este inspector — ver
  // hooks/useMuestras.ts. Reemplaza el mecanismo liviano anterior (un solo
  // "grupo activo" en memoria) por carpetas reales que se listan acá.
  const grupos = useGrupos() ?? [];
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
  // Traba de verdad (ver el mismo patrón, con la explicación completa, en
  // /inspector/grupo/nuevo/page.tsx): un `ref` corta un segundo toque
  // disparado en el instante entre "ya se creó" y "ya se navegó a la nueva
  // pantalla", que el estado `creandoMuestra` solo (por sí mismo) no
  // alcanzaba a evitar — antes eso podía crear dos muestras en blanco.
  const creandoRef = useRef(false);

  async function nueva() {
    if (creandoRef.current) return;
    creandoRef.current = true;
    setCreandoMuestra(true);
    setErrorNueva(null);
    try {
      const m = await createMuestra();
      router.push(`/inspector/muestra/${m.id}`);
      // No se libera la traba acá a propósito: ya se está navegando fuera de
      // esta pantalla (ver comentario en grupo/nuevo/page.tsx).
    } catch (err) {
      console.error("[Nueva muestra] no se pudo crear", err);
      setErrorNueva("No se pudo crear la muestra. Probá de nuevo.");
      creandoRef.current = false;
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

  // Eliminar un Grupo de especificaciones (carpeta) — pedido explícito del
  // cliente: "falta una opción que permita eliminar una especificación",
  // por ejemplo para borrar los duplicados que dejó el bug del doble-toque
  // (ver arriba). Solo borra el grupo, nunca las muestras ya creadas dentro
  // (ver eliminarGrupoLocal en lib/db.ts) — por eso no hace falta avisar de
  // pérdida de datos en el modal, a diferencia de "Limpiar registros".
  const [grupoAEliminar, setGrupoAEliminar] = useState<GrupoEntry | null>(null);
  const [eliminandoGrupo, setEliminandoGrupo] = useState(false);
  const [errorEliminarGrupo, setErrorEliminarGrupo] = useState<string | null>(null);

  async function confirmarEliminarGrupo() {
    if (!grupoAEliminar) return;
    setEliminandoGrupo(true);
    setErrorEliminarGrupo(null);
    try {
      await eliminarGrupo(grupoAEliminar.id);
      setGrupoAEliminar(null);
    } catch (e) {
      console.error("[grupo] no se pudo eliminar", e);
      setErrorEliminarGrupo("No se pudo eliminar el grupo. Probá de nuevo.");
    } finally {
      setEliminandoGrupo(false);
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

      {/* Grupos de especificaciones ("carpetas"): cada uno guarda Cliente/
          Destino/Variedad/Formato/Calibre/etc. una sola vez, para no
          repetirlos por cada empacador de la línea (~40 por jornada). Entrar
          a una carpeta permite agregar muestras que heredan esas specs. Se
          crea uno nuevo cuando cambia el formato/especificación (3-4 veces
          al día) — ver /inspector/grupo/nuevo y hooks/useMuestras.ts. */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Grupos de especificaciones</h2>
          <Link href="/inspector/grupo/nuevo">
            <Button variant="outline" size="sm">
              <FolderPlus className="h-4 w-4" /> Nuevo grupo
            </Button>
          </Link>
        </div>
        {grupos.length === 0 ? (
          <p className="rounded-md border border-dashed border-ink/15 px-3 py-2.5 text-xs text-muted">
            Todavía no creaste ningún grupo. Creá uno cuando vayas a evaluar varios empacadores con
            las mismas Especificaciones (Cliente/Destino/Variedad/Formato/Calibre...).
          </p>
        ) : (
          <div className="space-y-1.5">
            {grupos.map((g) => {
              const specsResumen = [
                g.especificaciones.cliente,
                g.especificaciones.destino,
                g.especificaciones.variedad,
                g.especificaciones.formato,
                g.especificaciones.calibre,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <Card key={g.id} className="overflow-hidden transition-shadow hover:shadow-sm">
                  {/* El botón de eliminar queda FUERA del Link (no anidado
                      adentro) — un <button> dentro de un <a> es HTML
                      inválido y en la práctica el navegador no deja tocar
                      solo el botón sin disparar también la navegación. */}
                  <div className="flex items-center gap-1 p-2.5">
                    <Link
                      href={`/inspector/grupo/${g.id}`}
                      className="flex min-w-0 flex-1 items-center gap-3"
                    >
                      <Folder className="h-5 w-5 shrink-0 text-brand" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{g.nombre}</p>
                        <p className="truncate text-xs text-muted">{specsResumen || "Sin especificaciones cargadas"}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setErrorEliminarGrupo(null);
                        setGrupoAEliminar(g);
                      }}
                      className="shrink-0 rounded-md p-1.5 text-muted hover:bg-danger/10 hover:text-danger"
                      aria-label={`Eliminar grupo ${g.nombre}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <h2 className="mb-2 text-sm font-semibold text-ink">Todas mis muestras</h2>

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
            // La Nota mostrada prioriza la elegida a mano (notaManual); si no
            // hay ninguna (null = todavía sin definir, incluye registros
            // viejos previos a este campo) cae al cálculo automático.
            const notaMostrada = m.notaManual ?? (r.cumple ? 15 : 5);
            return (
              <Card key={m.id} className="overflow-hidden transition-shadow hover:shadow-sm">
                <Link href={`/inspector/muestra/${m.id}`}>
                  <CardContent className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-ink">{m.codigo}</span>
                        <Badge variant={notaMostrada === 15 ? "success" : "danger"}>
                          Nota {notaMostrada}
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

      <ConfirmDialog
        open={grupoAEliminar !== null}
        title="¿Eliminar este grupo?"
        description={
          <>
            Se va a eliminar la carpeta <strong>{grupoAEliminar?.nombre}</strong>. Las muestras que
            ya hayas cargado dentro de ella NO se borran — quedan intactas en &quot;Todas mis
            muestras&quot;, cada una con su propia copia de las Especificaciones.
            {errorEliminarGrupo && (
              <p className="mt-3 rounded-md border border-danger/30 bg-danger/10 px-2.5 py-1.5 text-xs font-medium text-danger">
                {errorEliminarGrupo}
              </p>
            )}
          </>
        }
        confirmLabel="Sí, eliminar"
        busy={eliminandoGrupo}
        onConfirm={confirmarEliminarGrupo}
        onCancel={() => setGrupoAEliminar(null)}
      />
    </main>
  );
}
