"use client";

import { forwardRef } from "react";
import { computeMuestra, resolveDestinoTier } from "@/lib/calc";
import { DEFECTS, ROLLUP_ORDER, ROLLUP_LABEL, TOLERANCE_BY_KEY, toleranceMax } from "@/lib/defects";
import { fmtDateUI } from "@/lib/utils";
import type { ClamshellResult } from "@/lib/types";
import type { Muestra } from "@/lib/types";

const DEFECT_LABEL = Object.fromEntries(DEFECTS.map((d) => [d.key, d.label]));
const DEFECT_CAT = Object.fromEntries(DEFECTS.map((d) => [d.key, d.category]));

/** Agrupa los defectos de un clamshell por Clasificación (rollup), en el
 *  mismo orden oficial que usa ClamshellEditor (ROLLUP_ORDER) — solo las
 *  clasificaciones que tienen al menos un defecto presente (pct > 0). */
function agruparPorClasificacion(cr: ClamshellResult) {
  return ROLLUP_ORDER.map((rollup) => {
    const defectos = DEFECTS.filter((d) => d.rollup === rollup && (cr.defectPct[d.key] || 0) > 0).sort(
      (a, b) => (cr.defectPct[b.key] || 0) - (cr.defectPct[a.key] || 0)
    );
    return { rollup, defectos, pct: cr.rollupPct[rollup] || 0, cumple: cr.rollupCumple[rollup] };
  }).filter((g) => g.defectos.length > 0);
}

type ReportViewProps = {
  muestra: Muestra;
  /**
   * "export" (por defecto): ancho fijo de 820px, tal como antes — se usa para
   * capturar el reporte con html2canvas y generar el PNG/PDF, así ese export
   * mantiene siempre el mismo layout nítido sin importar el dispositivo.
   * "screen": responsivo, sin ancho fijo — se usa para mostrar el reporte en
   * pantalla (incluido el celular), con las columnas apilándose en 1 sola
   * columna en pantallas chicas en vez de achicarse hasta quedar ilegible.
   */
  variant?: "export" | "screen";
};

/**
 * Reporte visual ejecutivo — réplica 1:1 de la evaluación en Excel.
 * Ver `variant` arriba: la app renderiza dos instancias (una visible y
 * responsiva, otra oculta con ancho fijo solo para exportar) — ver
 * app/reporte/[id]/page.tsx.
 */
export const ReportView = forwardRef<HTMLDivElement, ReportViewProps>(
  function ReportView({ muestra: m, variant = "export" }, ref) {
    const r = computeMuestra(m);
    const cumple = r.cumple;
    const isExport = variant === "export";
    // Tier de tolerancia según destino/embalaje de ESTA muestra (mismo
    // criterio que usa el cálculo, ver lib/defects.ts) — se usa para el tope
    // de cada Clasificación mostrada abajo.
    const tier = resolveDestinoTier(m.destino, m.embalajeCaja);

    return (
      <div
        ref={ref}
        style={isExport ? { width: 820 } : undefined}
        className={`mx-auto bg-white text-[#0F172A] ${
          isExport ? "p-6" : "w-full max-w-[820px] p-3 sm:p-6"
        }`}
      >
        {/* Título */}
        <h1 className="mb-4 text-center text-[15px] font-bold uppercase leading-snug tracking-wide">
          Evaluación de Calidad de P.T. en Clamshell — en Líneas de Empaque
        </h1>

        {/* Cabecera de muestra */}
        <div className="mb-3 rounded-lg border border-[#E2E8F0] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[15px] font-bold">
              MUESTRA: <span className="font-mono">{m.codigo}</span>
            </div>
            <div
              className={`flex items-center gap-1 text-[15px] font-extrabold ${
                cumple ? "text-[#16A34A]" : "text-[#DC2626]"
              }`}
            >
              {cumple ? "✓ CUMPLE" : "✗ NO CUMPLE"}
            </div>
          </div>
          <div
            className={`grid gap-x-8 gap-y-1.5 text-[13px] ${
              isExport ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"
            }`}
          >
            <Field label="Fecha de cosecha" value={fmtDateUI(m.fechaCosecha)} />
            <Field label="Fecha de empaque" value={fmtDateUI(m.fechaEmpaque)} />
            <Field label="Planta de Empaque" value={m.plantaEmpaque || "—"} />
            <Field label="Turno de empaque" value={m.turno} />
            <Field label="N° Semana" value={m.semana ?? "—"} />
            <Field label="Hora de evaluación" value={m.horaEvaluacion || "—"} />
          </div>
        </div>

        {/* Personal + Especificaciones */}
        <div className={`mb-3 grid gap-3 ${isExport ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
          <div className="rounded-lg border border-[#E2E8F0] p-4">
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#64748B]">Personal</h3>
            <div className="space-y-1.5 text-[13px]">
              <Field label="Inspector de calidad" value={m.inspector || "—"} />
              <Field label="Línea" value={m.linea || "—"} />
              <Field label="Supervisor de producción" value={m.supervisor || "—"} />
              <Field label="Empacador" value={m.empacador || "—"} />
              <Field label="DNI empacador" value={m.dniEmpacador || "—"} />
            </div>
          </div>
          <div className="rounded-lg border border-[#E2E8F0] p-4">
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#64748B]">
              Especificaciones de Evaluación
            </h3>
            <div className="space-y-1.5 text-[13px]">
              <Field label="Cliente" value={m.cliente || "—"} />
              <Field label="Destino" value={m.destino || "—"} />
              <Field label="Variedad" value={m.variedad || "—"} />
              <Field label="Formato" value={m.formato || "—"} />
              <Field label="Tipo de empaque" value={m.tipoEmpaque || "—"} />
              <Field label="Calibre" value={m.calibre || "—"} />
              <Field label="Peso establecido" value={m.pesoEstablecido || "—"} />
              <Field label="Embalaje caja" value={m.embalajeCaja || "—"} />
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div
          className={`mb-3 grid gap-3 rounded-lg border border-[#E2E8F0] p-4 ${
            isExport ? "grid-cols-4" : "grid-cols-2 sm:grid-cols-4"
          }`}
        >
          <Kpi label="Total Bayas" value={String(r.totalBayas)} color="#0F172A" />
          <Kpi label="Cat 1" value={`${(r.pctCat1 * 100).toFixed(1)}%`} color="#0F172A" />
          <Kpi label="Aprovechable" value={`${(r.pctAprovechable * 100).toFixed(1)}%`} color="#16A34A" />
          <Kpi label="Descarte" value={`${(r.pctDescarte * 100).toFixed(1)}%`} color="#DC2626" />
        </div>

        {/* Clamshells */}
        <div className="space-y-3">
          {r.clamshells.map((cr) => {
            const grupos = agruparPorClasificacion(cr);
            return (
              <div
                key={cr.nClamshell}
                className={`grid gap-4 rounded-lg border border-[#E2E8F0] p-4 ${
                  isExport ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"
                }`}
              >
                <div>
                  <h4 className="mb-2 text-[13px] font-bold">CLAMSHELL {cr.nClamshell}</h4>

                  {grupos.length === 0 ? (
                    <p className="text-[13px] text-[#16A34A]">Sin defectos registrados</p>
                  ) : (
                    <div className="space-y-2">
                      {grupos.map((g) => {
                        const tol = TOLERANCE_BY_KEY[g.rollup];
                        const max = tol ? toleranceMax(tol, tier) : 0;
                        return (
                          <div key={g.rollup} className="overflow-hidden rounded-md border border-[#E2E8F0]">
                            {/* Cabecera de la Clasificación: nombre + % acumulado / tope
                                de tolerancia del destino — misma estructura que las
                                demás tarjetas del reporte (título arriba, métrica al
                                lado), no una nota entre paréntesis. */}
                            <div
                              className={`flex items-center justify-between gap-2 px-2.5 py-1.5 text-[12px] ${
                                g.cumple ? "bg-[#F8FAFC]" : "bg-[#FEF2F2]"
                              }`}
                            >
                              <span className="font-bold uppercase">{ROLLUP_LABEL[g.rollup]}</span>
                              <span className={`font-bold ${g.cumple ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
                                {(g.pct * 100).toFixed(2)}%{" "}
                                <span className="font-normal text-[#94A3B8]">/ tope {(max * 100).toFixed(0)}%</span>
                              </span>
                            </div>
                            {/* Desglose: los defectos específicos de esta Clasificación,
                                cada uno con su propio % — debajo de la cabecera, no
                                inline ni entre paréntesis. */}
                            <div className="space-y-1 px-2.5 py-1.5">
                              {g.defectos.map((d) => (
                                <div key={d.key} className="flex items-center justify-between gap-3 text-[13px]">
                                  <span
                                    className={
                                      DEFECT_CAT[d.key] === "descarte" ? "text-[#DC2626]" : "text-[#16A34A]"
                                    }
                                  >
                                    {DEFECT_LABEL[d.key]}
                                  </span>
                                  <span
                                    className={`shrink-0 font-bold ${
                                      DEFECT_CAT[d.key] === "descarte" ? "text-[#DC2626]" : "text-[#16A34A]"
                                    }`}
                                  >
                                    {((cr.defectPct[d.key] || 0) * 100).toFixed(2)}%
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="space-y-1.5 text-[13px]">
                  <Field label="N° bayas evaluadas" value={cr.nBayasEvaluadas} />
                  <Field label="Nota" value={cr.nota} />
                  <Field
                    label="Estándar"
                    value={
                      <span className={cr.cumple ? "text-[#16A34A]" : "text-[#DC2626]"}>{cr.estandar}</span>
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Observaciones */}
        {(m.observaciones || m.clamshells.some((c) => c.observacion)) && (
          <div className="mt-3 rounded-lg border border-[#E2E8F0] p-3 text-[12px]">
            <span className="font-bold italic">Observación: </span>
            <span className="italic text-[#334155]">
              {m.observaciones}
              {m.clamshells
                .filter((c) => c.observacion)
                .map((c) => ` · C${c.nClamshell}: ${c.observacion}`)
                .join("")}
            </span>
          </div>
        )}

        <p className="mt-4 text-center text-[10px] text-[#94A3B8]">
          BH-F-CCA-006 · Generado el {fmtDateUI(new Date().toISOString().slice(0, 10))} ·{" "}
          Medida correctiva: {m.medidaCorrectiva}
        </p>
      </div>
    );
  }
);

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-1">
      <span className="text-[#64748B]">{label}:</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="text-center">
      <p className="text-[11px] text-[#64748B]">{label}</p>
      <p className="text-[22px] font-bold" style={{ color }}>
        {value}
      </p>
    </div>
  );
}
