"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, FileText, Copy, Check, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MuestraHeaderForm } from "@/components/inspector/MuestraHeaderForm";
import { ClamshellEditor } from "@/components/inspector/ClamshellEditor";
import { useMuestra, updateMuestra, removeMuestra } from "@/hooks/useMuestras";
import { computeMuestra, emptyClamshell } from "@/lib/calc";
import { copyMuestraToClipboard } from "@/lib/excel";

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

  const [draft, setDraft] = useState<Muestra | null>(null);
  const [tab, setTab] = useState<"datos" | number>("datos"); // number = índice de clamshell
  const [copied, setCopied] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Carga inicial del borrador desde el registro almacenado.
  useEffect(() => {
    if (stored && !draft) setDraft(stored);
  }, [stored, draft]);

  // Autosave con debounce.
  function patch(next: Muestra) {
    setDraft(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => updateMuestra(next), 400);
  }

  if (!draft) {
    return (
      <main className="px-4 py-10 text-center text-sm text-muted">Cargando muestra…</main>
    );
  }

  const res = computeMuestra(draft);
  const clamshells = [...draft.clamshells].sort((a, b) => a.nClamshell - b.nClamshell);

  function updateClamshell(cs: Clamshell) {
    patch({ ...draft!, clamshells: draft!.clamshells.map((c) => (c.id === cs.id ? cs : c)) });
  }

  function addClamshell() {
    const n = (clamshells.at(-1)?.nClamshell ?? 0) + 1;
    const cs = emptyClamshell(draft!.id, n);
    patch({ ...draft!, clamshells: [...draft!.clamshells, cs] });
    setTab(clamshells.length);
  }

  function deleteClamshell(csId: string) {
    if (draft!.clamshells.length <= 1) return;
    patch({ ...draft!, clamshells: draft!.clamshells.filter((c) => c.id !== csId) });
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
          <Badge variant={res.cumple ? "success" : "danger"}>
            {res.cumple ? "CUMPLE" : "NO CUMPLE"}
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
                <ClamshellEditor clamshell={clamshells[tab as number]} muestra={draft} onChange={updateClamshell} />
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* Barra de acciones fija */}
      <div className="no-print safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5">
          <Button variant="outline" className="flex-1" onClick={copiar}>
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            {copied ? "¡Copiado!" : "Copiar fila Excel"}
          </Button>
          <Link href={`/reporte/${draft.id}`} className="flex-1">
            <Button className="w-full">
              <FileText className="h-4 w-4" /> Ver reporte
            </Button>
          </Link>
          <Button variant="ghost" size="icon" className="text-danger" onClick={eliminarMuestra} aria-label="Eliminar muestra">
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
