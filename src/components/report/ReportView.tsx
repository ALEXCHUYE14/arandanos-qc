"use client";

import { forwardRef } from "react";
import { computeMuestra } from "@/lib/calc";
import { DEFECTS } from "@/lib/defects";
import { fmtDateUI } from "@/lib/utils";
import type { Muestra } from "@/lib/types";

const DEFECT_LABEL = Object.fromEntries(DEFECTS.map((d) => [d.key, d.label]));
const DEFECT_CAT = Object.fromEntries(DEFECTS.map((d) => [d.key, d.category]));

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
            <Field label="Planta de Empaque" value={m.nPlanta ?? "—"} />
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
              <Field label="Supervisor" value={m.supervisor || "—"} />
              <Field label="Empacador" value={m.empacador || "—"} />
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
              <Field label="Peso establecido" value={m.pesoEstablecido ? `${m.pesoEstablecido}g` : "—"} />
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
            const cs = m.clamshells.find((c) => c.nClamshell === cr.nClamshell)!;
            const defectsShown = Object.entries(cr.defectPct)
              .filter(([, pct]) => pct > 0)
              .sort((a, b) => b[1] - a[1]);
            return (
              <div
                key={cr.nClamshell}
                className={`grid gap-4 rounded-lg border border-[#E2E8F0] p-4 ${
                  isExport ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"
                }`}
              >
                <div>
                  <h4 className="mb-2 text-[13px] font-bold">CLAMSHELL {cr.nClamshell}</h4>
                  {defectsShown.length === 0 ? (
                    <p className="text-[13px] text-[#16A34A]">Sin defectos registrados</p>
                  ) : (
                    <div className="space-y-1">
                      {defectsShown.map(([key, pct]) => (
                        <div key={key} className="flex items-center justify-between gap-3 text-[13px]">
                          <span
                            className={`font-semibold ${
                              DEFECT_CAT[key] === "descarte" ? "text-[#DC2626]" : "text-[#16A34A]"
                            }`}
                          >
                            {DEFECT_LABEL[key]}
                          </span>
                          <span
                            className={`font-bold ${
                              DEFECT_CAT[key] === "descarte" ? "text-[#DC2626]" : "text-[#16A34A]"
                            }`}
                          >
                            {(pct * 100).toFixed(2)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-[13px]">
                    {cr.nBayasEvaluadas} bayas · Nota {cr.nota} ·{" "}
                    <span className={cr.cumple ? "text-[#16A34A]" : "text-[#DC2626]"}>{cr.estandar}</span>
                  </p>
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
