"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, FileText, Copy, Check, PackagePlus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MuestraHeaderForm } from "@/components/inspector/MuestraHeaderForm";
import { ClamshellEditor } from "@/components/inspector/ClamshellEditor";
import { useMuestra, updateMuestra, removeMuestra, esDelUsuarioActual } from "@/hooks/useMuestras";
import { computeMuestra, emptyClamshell } from "@/lib/calc";
import { copyMuestraToClipboard } from "@/lib/excel";
import { useAuth } from "@/lib/store";

// Chequeo liviano (sin importar lib/supabase, que arrastra todo el SDK de
// Supabase al bundle de esta página solo para leer un booleano).
const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
import { cn } from "@/lib/utils";
import type { Clamshell, Muestra } from "@/lib/types";

export default function CapturaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const stored = useMuestra(id);
  const auth = useAuth();

  const [draft, setDraft] = useState<Muestra | null>(null);
  const [tab, setTab] = useState<"datos" | number>("datos"); // number = índice de clamshell
  const [copied, setCopied] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref espejo de `draft`, actualizada en CADA render (no solo dentro de un
  // efecto) — la necesita flushSave() de abajo para leer siempre el valor
  // más fresco sin depender de que el listener de visibilitychange/pagehide
  // haya sido re-creado con el último `draft` en su clausura.
  const draftRef = useRef<Muestra | null>(null);
  draftRef.current = draft;

  // Carga inicial del borrador desde el registro almacenado.
  useEffect(() => {
    if (stored && !draft) setDraft(stored);
  }, [stored, draft]);

  // Autosave con debounce (400ms) — pero el guardado en sí queda PENDIENTE
  // en un simple setTimeout del navegador hasta que se cumple ese plazo.
  // Bug real reportado por el cliente: un inspector terminaba de cargar los
  // 14 clamshells de un empacador y, si bloqueaba la pantalla o cambiaba de
  // app justo después del último toque, el celular podía suspender ese
  // temporizador antes de que llegara a dispararse — esa última tanda de
  // datos nunca se escribía en IndexedDB, y la muestra quedaba con menos
  // información de la que el inspector realmente cargó (de ahí el "4% de
  // descarte" que después aparecía en 0%: literalmente no se había guardado
  // el conteo de defectos). flushSave() + los listeners de abajo fuerzan el
  // guardado INMEDIATO (sin esperar los 400ms) apenas la pestaña deja de
  // estar visible o la página se va a cerrar — así el último cambio queda a
  // salvo pase lo que pase con el temporizador.
  function flushSave() {
    if (!saveTimer.current) return; // no hay nada pendiente: ya se guardó
    clearTimeout(saveTimer.current);
    saveTimer.current = null;
    if (draftRef.current) updateMuestra(draftRef.current);
  }

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") flushSave();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    // "pagehide" (no "beforeunload"): dispara de forma confiable en
    // navegadores móviles también cuando la página pasa a la caché de
    // retroceso (bfcache) o la pestaña se cierra, a diferencia de
    // beforeunload, que en varios navegadores móviles no llega a correr.
    window.addEventListener("pagehide", flushSave);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", flushSave);
      // También al desmontar por navegación DENTRO de la app (ej. tocar
      // "Muestras" o "Ver reporte" antes de que pasen los 400ms) — el
      // temporizador seguiría corriendo solo igual, pero flushear acá
      // adelanta el guardado sin depender de que el navegador no lo mate.
      flushSave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Acepta una Muestra completa (como antes — la usa MuestraHeaderForm, que
  // arma el objeto entero a partir de su propio prop `m`) O una función que
  // recibe el `draft` MÁS RECIENTE y devuelve el siguiente (la usan
  // updateClamshell/addClamshell/deleteClamshell abajo). La forma función es
  // la que hay que preferir para cualquier cambio nuevo: `setDraft(prev =>
  // ...)` siempre parte del estado más al día que React tenga en ese
  // instante, nunca de un `draft` capturado en la clausura de un cierre
  // viejo — cierra por completo cualquier ventana, por chica que sea, en la
  // que dos cambios seguidos pudieran pisarse entre sí en vez de sumarse.
  function patch(nextOrUpdater: Muestra | ((prev: Muestra) => Muestra)) {
    setDraft((prev) => {
      const base = prev ?? draftRef.current!;
      const next = typeof nextOrUpdater === "function" ? nextOrUpdater(base) : nextOrUpdater;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null;
        updateMuestra(next);
      }, 400);
      return next;
    });
  }

  if (!draft) {
    return (
      <main className="px-4 py-10 text-center text-sm text-muted">Cargando muestra…</main>
    );
  }

  // Aislamiento por usuario (ver useMuestras() en hooks/useMuestras.ts, que
  // ya filtra "Mis muestras" por createdBy): esto cierra el caso de entrar
  // por URL directa a una muestra que no es de este inspector — jefatura
  // igual puede abrir cualquiera (no navega normalmente por acá, pero no
  // hay motivo para bloquearla si lo hace).
  if (
    auth.userId &&
    auth.profile?.rol !== "jefatura" &&
    !esDelUsuarioActual(draft, auth.userId, auth.profile?.nombre ?? null)
  ) {
    return (
      <main className="px-4 py-10 text-center text-sm text-muted">
        Esta muestra no te pertenece o no existe.
      </main>
    );
  }

  const res = computeMuestra(draft);
  // Nota mostrada en la cabecera: la manual (elegida a mano en la sección
  // Evaluación) si ya se puso una; si no (todavía "— (automático)", o una
  // muestra vieja de antes de que existiera este campo), cae al veredicto
  // automático de siempre (res.cumple) — nunca queda en blanco ni rompe.
  const notaMostrada = draft.notaManual ?? (res.cumple ? 15 : 5);
  const clamshells = [...draft.clamshells].sort((a, b) => a.nClamshell - b.nClamshell);

  function updateClamshell(cs: Clamshell) {
    patch((prev) => ({ ...prev, clamshells: prev.clamshells.map((c) => (c.id === cs.id ? cs : c)) }));
  }

  function addClamshell() {
    patch((prev) => {
      const ordenados = [...prev.clamshells].sort((a, b) => a.nClamshell - b.nClamshell);
      const n = (ordenados.at(-1)?.nClamshell ?? 0) + 1;
      const cs = emptyClamshell(prev.id, n);
      // El N° de bayas evaluadas casi siempre se repite dentro del mismo
      // lote — se hereda del clamshell anterior en vez de arrancar de
      // nuevo en 99.
      const anterior = ordenados.at(-1);
      if (anterior?.nBayasEvaluadas) cs.nBayasEvaluadas = anterior.nBayasEvaluadas;
      return { ...prev, clamshells: [...prev.clamshells, cs] };
    });
    setTab(clamshells.length);
  }

  function deleteClamshell(csId: string) {
    if (draft!.clamshells.length <= 1) return;
    patch((prev) => ({ ...prev, clamshells: prev.clamshells.filter((c) => c.id !== csId) }));
    setTab("datos");
  }

  async function eliminarMuestra() {
    if (confirm(`¿Eliminar la muestra ${draft!.codigo}? Esta acción no se puede deshacer.`)) {
      await removeMuestra(draft!.id);
      router.push("/inspector");
    }
  }

  async function copiar() {
    await copyMuestraToClipboard(draft!);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /**
   * Guarda de inmediato (sin esperar los 400ms del debounce) y vuelve a la
   * lista. El autoguardado ya corre solo desde el primer cambio — este botón
   * no cambia esa lógica, es una confirmación explícita para que el
   * inspector pueda pausar y salir con la tranquilidad de que quedó guardado.
   */
  async function guardarYSalir() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await updateMuestra(draft!);
    router.push("/inspector");
  }

  return (
    <main className="px-4 py-4 pb-28">
      {/* Encabezado */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <Link href="/inspector" className="flex items-center gap-1 text-xs text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Muestras
        </Link>
        <div className="flex items-center gap-2">
          <span
            className="font-mono text-sm font-semibold text-ink"
            title={
              isSupabaseConfigured && draft.sync === "pending"
                ? "Provisorio: el código definitivo se asigna al sincronizar, para que nunca se repita entre dispositivos."
                : undefined
            }
          >
            {draft.codigo}
            {isSupabaseConfigured && draft.sync === "pending" && (
              <span className="ml-1 align-middle text-[10px] font-normal text-muted">(provisorio)</span>
            )}
          </span>
          {/* "Nota 15" (verde) / "Nota 5" (rojo) — antes decía "CUMPLE"/
              "NO CUMPLE". Prioriza la nota MANUAL (sección Evaluación); si
              todavía no se puso ninguna, cae al veredicto automático de
              siempre (ver notaMostrada arriba) — nunca queda en blanco. */}
          <Badge variant={notaMostrada === 15 ? "success" : "danger"}>
            Nota {notaMostrada}
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <div className="no-print mb-4 flex flex-wrap gap-1.5 border-b border-line pb-2">
        <TabBtn active={tab === "datos"} onClick={() => setTab("datos")}>
          Datos de muestra
        </TabBtn>
        {clamshells.map((cs, i) => {
          const r = computeMuestra({ ...draft, clamshells: [cs] }).clamshells[0];
          return (
            <TabBtn key={cs.id} active={tab === i} onClick={() => setTab(i)}>
              Clamshell {cs.nClamshell}
              <span
                className={cn(
                  "ml-1 inline-block h-2 w-2 rounded-full",
                  r.cumple ? "bg-success" : "bg-danger"
                )}
              />
            </TabBtn>
          );
        })}
        <button
          onClick={addClamshell}
          className="flex items-center gap-1 rounded-md border border-dashed border-line px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand-soft"
        >
          <PackagePlus className="h-4 w-4" /> Añadir clamshell
        </button>
      </div>

      {/* Contenido */}
      <Card>
        <CardContent className="p-4">
          {tab === "datos" ? (
            <MuestraHeaderForm m={draft} onChange={patch} />
          ) : (
            clamshells[tab as number] && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-ink">
                    Clamshell {clamshells[tab as number].nClamshell}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger"
                    onClick={() => deleteClamshell(clamshells[tab as number].id)}
                    disabled={draft.clamshells.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" /> Quitar
                  </Button>
                </div>
                {/* key={...id}: sin esto, React reutiliza la MISMA instancia de
                    ClamshellEditor (y de cada NumberInput adentro) al cambiar de
                    pestaña entre clamshells, porque queda en la misma posición
                    del árbol — cualquier estado interno (ej. el texto que se
                    está tipeando en "N° bayas evaluadas") podría arrastrarse de
                    un clamshell a otro por una fracción de segundo. Con la key
                    puesta, cambiar de clamshell fuerza un montaje limpio. */}
                <ClamshellEditor
                  key={clamshells[tab as number].id}
                  clamshell={clamshells[tab as number]}
                  muestra={draft}
                  onChange={updateClamshell}
                />
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* Barra de acciones fija.
          Bug en móvil: los 3 botones de texto usaban "flex-1" pero un ítem
          flex, por defecto, no se achica más allá del ancho de su propio
          contenido (min-width:auto) — y el texto de los botones usa
          whitespace-nowrap. En pantallas angostas eso hacía que la fila
          completa se saliera del ancho de la pantalla, empujando el botón de
          eliminar (icono, a la derecha) fuera del área visible/tocable — en
          PC, con más ancho disponible, nunca se notaba. Se corrige con
          min-w-0 en los contenedores flex-1 + truncate en las etiquetas, así
          los 3 botones se achican correctamente en vez de desbordar, y el
          botón de eliminar (shrink-0) siempre queda visible. Dispara la
          MISMA función eliminarMuestra() de siempre — no se tocó la lógica,
          solo el layout. */}
      <div className="no-print safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5">
          <Button variant="outline" className="min-w-0 flex-1" onClick={guardarYSalir}>
            <Save className="h-4 w-4 shrink-0" /> <span className="truncate">Guardar y salir</span>
          </Button>
          <Button variant="outline" className="min-w-0 flex-1" onClick={copiar}>
            {copied ? <Check className="h-4 w-4 shrink-0 text-success" /> : <Copy className="h-4 w-4 shrink-0" />}
            <span className="truncate">{copied ? "¡Copiado!" : "Copiar fila Excel"}</span>
          </Button>
          <Link href={`/reporte/${draft.id}`} className="min-w-0 flex-1">
            <Button className="w-full min-w-0">
              <FileText className="h-4 w-4 shrink-0" /> <span className="truncate">Ver reporte</span>
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-danger"
            onClick={eliminarMuestra}
            aria-label="Eliminar muestra"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </main>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "bg-brand text-white" : "text-muted hover:bg-base"
      )}
    >
      {children}
    </button>
  );
}
