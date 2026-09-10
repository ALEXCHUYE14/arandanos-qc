"use client";

import { useMemo, useState } from "react";
import { Search, CheckCircle2, XCircle } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DefectCounter } from "./DefectCounter";
import { APROVECHABLES, DESCARTES, ROLLUP_ORDER, ROLLUP_LABEL, toleranceMax, TOLERANCE_BY_KEY, type DefectDef, type RollupKey } from "@/lib/defects";
import { computeClamshell, resolveDestinoTier } from "@/lib/calc";
import { setBayasEvaluadasDefault } from "@/lib/db";
import { cn } from "@/lib/utils";
import type { Clamshell, Muestra } from "@/lib/types";

/** Agrupa una lista de defectos por su CLASIFICACIÓN (rollup), respetando
 *  el orden oficial de la hoja "Defectos" (ROLLUP_ORDER). */
function groupByRollup(list: DefectDef[]): { rollup: RollupKey; defectos: DefectDef[] }[] {
  const porRollup = new Map<RollupKey, DefectDef[]>();
  for (const d of list) {
    const arr = porRollup.get(d.rollup) || [];
    arr.push(d);
    porRollup.set(d.rollup, arr);
  }
  return ROLLUP_ORDER.filter((r) => porRollup.has(r)).map((r) => ({ rollup: r, defectos: porRollup.get(r)! }));
}

export function ClamshellEditor({
  clamshell,
  muestra,
  onChange,
}: {
  clamshell: Clamshell;
  muestra: Pick<Muestra, "destino" | "embalajeCaja" | "empacador" | "cliente">;
  onChange: (cs: Clamshell) => void;
}) {
  const [q, setQ] = useState("");
  const tier = resolveDestinoTier(muestra.destino, muestra.embalajeCaja, muestra.cliente);
  const res = computeClamshell(clamshell, tier);

  const setCount = (key: string, v: number) =>
    onChange({ ...clamshell, counts: { ...clamshell.counts, [key]: v } });

  function setBayas(v: number) {
    onChange({ ...clamshell, nBayasEvaluadas: v });
    // Se recuerda por empacador: casi siempre se repite dentro del mismo
    // lote, así la próxima muestra de este empacador ya arranca con el
    // número correcto (ver onEmpacadorChange en MuestraHeaderForm).
    if (muestra.empacador) void setBayasEvaluadasDefault(muestra.empacador, v);
  }

  const filt = (list: DefectDef[]) =>
    q.trim()
      ? list.filter((d) => d.label.toLowerCase().includes(q.toLowerCase()))
      : list;

  const aprovGrupos = useMemo(() => groupByRollup(filt(APROVECHABLES)), [q]);
  const descGrupos = useMemo(() => groupByRollup(filt(DESCARTES)), [q]);

  return (
    <div className="space-y-4">
      {/* Datos del clamshell */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <Label>N° bayas evaluadas</Label>
          <Input
            type="number"
            inputMode="numeric"
            className="no-spin"
            value={clamshell.nBayasEvaluadas || ""}
            onChange={(e) => setBayas(parseInt(e.target.value, 10) || 0)}
          />
        </div>
        <div>
          <Label>Nota (15 = cumple)</Label>
          <Input
            type="number"
            inputMode="numeric"
            className="no-spin"
            placeholder={`auto: ${res.cumple ? 15 : "<15"}`}
            value={clamshell.nota ?? ""}
            onChange={(e) =>
              onChange({ ...clamshell, nota: e.target.value === "" ? null : parseInt(e.target.value, 10) })
            }
          />
        </div>
        <div className="flex flex-col justify-end">
          <Label>Veredicto</Label>
          <div
            className={cn(
              "flex h-10 items-center justify-center gap-1 rounded-md text-sm font-bold",
              res.estandar === "CUMPLE" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
            )}
          >
            {res.estandar === "CUMPLE" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            {res.estandar}
          </div>
        </div>
      </div>

      {/* KPIs rápidos del clamshell */}
      <div className="grid grid-cols-3 gap-2">
        <Kpi label="Cat 1" value={`${(res.pctCat1 * 100).toFixed(1)}%`} tone="success" />
        <Kpi label="Aprovechable" value={`${(res.pctAprovechable * 100).toFixed(1)}%`} tone="success" />
        <Kpi label="Descarte" value={`${(res.pctDescarte * 100).toFixed(1)}%`} tone="danger" />
      </div>

      {/* Buscador de defectos */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          className="pl-9"
          placeholder="Buscar defecto…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* Defectos aprovechables, agrupados por Clasificación (ej. RESIDUOS DE COSECHA) */}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <Badge variant="success">DEFECTOS APROVECHABLES</Badge>
          <span className="text-xs text-muted">{res.aprovechableCount} bayas</span>
        </div>
        <div className="space-y-3">
          {aprovGrupos.map(({ rollup, defectos }) => (
            <RollupGroup key={rollup} rollup={rollup} defectos={defectos} res={res} tier={tier}>
              {defectos.map((d) => (
                <DefectCounter
                  key={d.key}
                  def={d}
                  value={clamshell.counts[d.key] || 0}
                  pct={res.defectPct[d.key] || 0}
                  onChange={(v) => setCount(d.key, v)}
                />
              ))}
            </RollupGroup>
          ))}
        </div>
      </section>

      {/* Defectos de descarte, agrupados por Clasificación */}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <Badge variant="danger">DEFECTOS DESCARTE</Badge>
          <span className="text-xs text-muted">{res.descarteCount} bayas</span>
        </div>
        <div className="space-y-3">
          {descGrupos.map(({ rollup, defectos }) => (
            <RollupGroup key={rollup} rollup={rollup} defectos={defectos} res={res} tier={tier}>
              {defectos.map((d) => (
                <DefectCounter
                  key={d.key}
                  def={d}
                  value={clamshell.counts[d.key] || 0}
                  pct={res.defectPct[d.key] || 0}
                  onChange={(v) => setCount(d.key, v)}
                />
              ))}
            </RollupGroup>
          ))}
        </div>
      </section>

      {/* Observación del clamshell */}
      <div>
        <Label>Observación (clamshell)</Label>
        <Input
          value={clamshell.observacion}
          placeholder="Nota breve…"
          onChange={(e) => onChange({ ...clamshell, observacion: e.target.value })}
        />
      </div>
    </div>
  );
}

/** Encabezado de una Clasificación (ej. "RESIDUOS DE COSECHA — 2.1% (tope 4%)")
 *  con la sumatoria en vivo del subgrupo y si cumple o no su tope de tolerancia. */
function RollupGroup({
  rollup,
  res,
  tier,
  children,
}: {
  rollup: RollupKey;
  defectos: DefectDef[];
  res: ReturnType<typeof computeClamshell>;
  tier: ReturnType<typeof resolveDestinoTier>;
  children: React.ReactNode;
}) {
  const pct = res.rollupPct[rollup] || 0;
  const cumple = res.rollupCumple[rollup];
  const tol = TOLERANCE_BY_KEY[rollup];
  const max = tol ? toleranceMax(tol, tier) : 0;

  return (
    <div className="rounded-md border border-line">
      <div className="flex items-center justify-between gap-2 border-b border-line bg-base px-2.5 py-1.5">
        <span className="text-xs font-semibold text-ink">{ROLLUP_LABEL[rollup]}</span>
        <span className={cn("text-xs font-bold", cumple ? "text-success" : "text-danger")}>
          {(pct * 100).toFixed(2)}% <span className="font-normal text-muted">/ tope {(max * 100).toFixed(0)}%</span>
        </span>
      </div>
      <div className="grid gap-1.5 p-2 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: "success" | "warning" | "danger" }) {
  const color =
    tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-danger";
  return (
    <div className="rounded-md border border-line bg-surface p-2 text-center">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className={cn("text-lg font-bold", color)}>{value}</p>
    </div>
  );
}
