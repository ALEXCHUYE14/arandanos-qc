"use client";

/**
 * Pantalla de diagnóstico — no forma parte del flujo normal de carga
 * (ningún inspector necesita entrar acá para trabajar). Muestra el
 * registro que dejan pullAll()/resolveConflictUseServer() (lib/sync.ts)
 * cada vez que detectan que el N° de clamshells de una muestra BAJÓ al
 * fusionar con el servidor — pensado específicamente para el reporte
 * repetido de "cargo un clamshell, sincronizo, y desaparece", que no se
 * pudo reproducir con pruebas automatizadas. Si vuelve a pasar en un
 * dispositivo real, este registro queda como evidencia concreta (de dónde
 * vino el cambio, qué devolvió el servidor) en vez de tener que adivinar a
 * partir de una captura de pantalla.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { listSyncLog } from "@/lib/db";
import type { SyncLogEntry } from "@/lib/db";

export default function DiagnosticoPage() {
  const [log, setLog] = useState<SyncLogEntry[]>([]);
  const [cargando, setCargando] = useState(true);
  const [copiado, setCopiado] = useState(false);

  async function cargar() {
    setCargando(true);
    setLog(await listSyncLog());
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function copiarTodo() {
    const texto = log
      .map(
        (e) =>
          `[${e.ts}] ${e.origen} — ${e.codigo || e.muestraId} — clamshells ${e.clamshellsAntes} → ${e.clamshellsDespues}\n  ${e.detalle}`
      )
      .join("\n\n");
    await navigator.clipboard.writeText(texto || "(sin eventos registrados)");
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <main className="px-4 py-5">
      <div className="mb-4">
        <Link href="/inspector" className="mb-1 flex items-center gap-1 text-xs text-muted hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Mis muestras
        </Link>
        <h1 className="text-xl font-bold text-ink">Diagnóstico</h1>
        <p className="text-xs text-muted">
          Registro automático de cada vez que una sincronización detectó que un clamshell desapareció.
          Si esto vuelve a pasar, tocá &quot;Copiar todo&quot; y mandá el texto — no hace falta entender lo que dice.
        </p>
      </div>

      <div className="mb-3 flex gap-2">
        <Button variant="outline" size="sm" onClick={cargar} disabled={cargando}>
          <RefreshCw className={`h-4 w-4 ${cargando ? "animate-spin" : ""}`} /> Actualizar
        </Button>
        <Button size="sm" onClick={copiarTodo} disabled={log.length === 0}>
          {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copiado ? "Copiado" : "Copiar todo"}
        </Button>
      </div>

      {log.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted">
            {cargando ? "Cargando…" : "Sin eventos registrados todavía en este dispositivo."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {log.map((e) => (
            <Card key={e.id}>
              <CardContent className="p-3 text-xs">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold text-ink">{e.codigo || e.muestraId}</span>
                  <span className="rounded bg-danger/10 px-1.5 py-0.5 font-semibold text-danger">
                    {e.clamshellsAntes} → {e.clamshellsDespues} clamshells
                  </span>
                  <span className="text-muted">{e.origen}</span>
                  <span className="text-muted">{e.ts}</span>
                </div>
                <p className="text-muted">{e.detalle}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
