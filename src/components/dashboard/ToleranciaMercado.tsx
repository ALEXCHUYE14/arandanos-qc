"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { overview, porEmpacador } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import type { Muestra } from "@/lib/types";

/**
 * Los 3 mercados reales del cliente (hoja "Lista Maestra" del Excel de
 * referencia: DESTINO solo toma estos 3 valores). Europa y EE.UU. comparten
 * la misma tolerancia base ("EUROPA/USA" en la hoja "Defectos"), salvo que
 * dentro de EE.UU. el embalaje "... SWEETEST BATCH" activa una tolerancia más
 * estricta — eso ya lo resuelve computeMuestra/resolveDestinoTier por dentro,
 * acá solo se filtra por el destino real de cada muestra.
 */
const MERCADOS = [
  { key: "CHINA", label: "China" },
  { key: "EUROPA", label: "Europa" },
  { key: "USA", label: "EE.UU." },
] as const;

type MercadoKey = (typeof MERCADOS)[number]["key"];

export function ToleranciaMercado({ muestras }: { muestras: Muestra[] }) {
  const [tab, setTab] = useState<MercadoKey>("CHINA");

  const porMercado = useMemo(() => {
    const map = new Map<MercadoKey, Muestra[]>();
    for (const mercado of MERCADOS) map.set(mercado.key, []);
    for (const m of muestras) {
      const d = (m.destino || "").trim().toUpperCase() as MercadoKey;
      if (map.has(d)) map.get(d)!.push(m);
    }
    return map;
  }, [muestras]);

  const activas = useMemo(() => porMercado.get(tab) || [], [porMercado, tab]);
  const stats = useMemo(() => overview(activas), [activas]);
  const emp = useMemo(() => porEmpacador(activas), [activas]);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">Tolerancia por mercado</h3>
          <div className="flex gap-1">
            {MERCADOS.map((mercado) => (
              <button
                key={mercado.key}
                type="button"
                onClick={() => setTab(mercado.key)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  tab === mercado.key ? "bg-brand text-white" : "bg-base text-muted hover:bg-brand-soft"
                )}
              >
                {mercado.label}
                <span className="ml-1 opacity-70">({(porMercado.get(mercado.key) || []).length})</span>
              </button>
            ))}
          </div>
        </div>

        {activas.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            Todavía no hay muestras con destino {MERCADOS.find((mm) => mm.key === tab)?.label}.
          </p>
        ) : (
          <>
            <div className="mb-3 grid grid-cols-3 gap-2">
              <MiniStat label="Muestras" value={String(stats.totalMuestras)} />
              <MiniStat label="Cumplimiento" value={`${(stats.pctCumplimiento * 100).toFixed(0)}%`} tone="success" />
              <MiniStat label="Descarte prom." value={`${(stats.pctDescartePromedio * 100).toFixed(1)}%`} tone="danger" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line text-xs uppercase text-muted">
                  <tr>
                    <th className="px-2 py-1.5">Empacador</th>
                    <th className="px-2 py-1.5 text-right">Muestras</th>
                    <th className="px-2 py-1.5 text-right">Descarte prom.</th>
                    <th className="px-2 py-1.5 text-center">Cumplimiento</th>
                  </tr>
                </thead>
                <tbody>
                  {emp.map((e) => (
                    <tr key={e.empacador} className="border-b border-line/60">
                      <td className="px-2 py-1.5">{e.empacador}</td>
                      <td className="px-2 py-1.5 text-right">{e.muestras}</td>
                      <td className="px-2 py-1.5 text-right font-semibold text-danger">
                        {(e.pctDescarte * 100).toFixed(1)}%
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <Badge variant={e.pctCumplimiento >= 0.5 ? "success" : "danger"}>
                          {(e.pctCumplimiento * 100).toFixed(0)}% cumple
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" }) {
  const color = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-ink";
  return (
    <div className="rounded-md border border-line bg-base p-2 text-center">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className={cn("text-base font-bold", color)}>{value}</p>
    </div>
  );
}
