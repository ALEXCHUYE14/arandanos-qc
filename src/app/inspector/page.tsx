"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, ChevronRight, Home, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMuestras, createMuestra } from "@/hooks/useMuestras";
import { computeMuestra } from "@/lib/calc";
import { fmtDateUI } from "@/lib/utils";

export default function InspectorListPage() {
  const router = useRouter();
  const muestras = useMuestras() ?? [];

  async function nueva() {
    const m = await createMuestra();
    router.push(`/inspector/muestra/${m.id}`);
  }

  return (
    <main className="px-4 py-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Link href="/" className="mb-1 flex items-center gap-1 text-xs text-muted hover:text-ink">
            <Home className="h-3.5 w-3.5" /> Inicio
          </Link>
          <h1 className="text-xl font-bold text-ink">Mis muestras</h1>
        </div>
        <Button onClick={nueva} size="lg">
          <Plus className="h-5 w-5" /> Nueva muestra
        </Button>
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
            return (
              <Link key={m.id} href={`/inspector/muestra/${m.id}`}>
                <Card className="transition-shadow hover:shadow-sm">
                  <CardContent className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-ink">{m.codigo}</span>
                        <Badge variant={r.cumple ? "success" : "danger"}>
                          {r.cumple ? "CUMPLE" : "NO CUMPLE"}
                        </Badge>
                        {m.sync === "pending" && <Badge variant="warning">sin sincronizar</Badge>}
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
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
