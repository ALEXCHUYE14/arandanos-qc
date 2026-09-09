"use client";

import { forwardRef } from "react";
import { computeMuestra, resolveDestinoTier } from "@/lib/calc";
import { DEFECTS, ROLLUP_LABEL, TOLERANCE_BY_KEY, toleranceMax } from "@/lib/defects";
import { fmtDateUI } from "@/lib/utils";
import type { Muestra } from "@/lib/types";

const DEFECT_LABEL = Object.fromEntries(DEFECTS.map((d) => [d.key, d.label]));
const DEFECT_CAT = Object.fromEntries(DEFECTS.map((d) => [d.key, d.category]));
/** Clasificación (rollup) de cada defecto — ej. "RESIDUOS DE COSECHA",
 *  "OTROS DEFECTOS LEVES" — para mostrarla junto al defecto en el reporte. */
const DEFECT_CLASIFICACION = Object.fromEntries(DEFECTS.map((d) => [d.key, ROLLUP_LABEL[d.rollup]]));

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
    // Tope de tolerancia de "RESIDUOS DE COSECHA" según destino/embalaje de
    // ESTA muestra (mismo criterio que usa el cálculo, ver lib/defects.ts).
    const tier = resolveDestinoTier(m.destino, m.embalajeCaja);
    const topeResiduos = toleranceMax(TOLERANCE_BY_KEY.residuos_cosecha, tier);

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

                  {/* Resumen de "RESIDUOS DE COSECHA" (corola, resto floral verde,
                      pedúnculo) contra el tope de tolerancia del destino.
                      Solo se muestra cuando el clamshell REALMENTE tiene algún
                      conteo en esa clasificación (pct > 0) — igual que el resto
                      de los defectos de abajo. Mostrarla siempre (incluso en
                      0%) generaba confusión: parecía que el sistema "marcaba"
                      Residuos de Cosecha en clamshells donde en realidad no
                      había ningún defecto, o donde el defecto real era otro
                      (ej. Inmadurez leve). El conteo por defecto sigue siendo
                      100% independiente por clamshell (ver ClamshellEditor /
                      calc.ts) — esto era solo un problema de cómo se mostraba
                      en el reporte, no de los datos guardados. */}
                  {(cr.rollupPct.residuos_cosecha || 0) > 0 && (
                    <div
                      className={`mb-2 flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-[12px] ${
                        cr.rollupCumple.residuos_cosecha
                          ? "border-[#E2E8F0] bg-[#F8FAFC]"
                          : "border-[#FCA5A5] bg-[#FEF2F2]"
                      }`}
                    >
                      <span className="font-semibold">{ROLLUP_LABEL.residuos_cosecha}</span>
                      <span
                        className={`font-bold ${
                          cr.rollupCumple.residuos_cosecha ? "text-[#16A34A]" : "text-[#DC2626]"
                        }`}
                      >
                        {((cr.rollupPct.residuos_cosecha || 0) * 100).toFixed(2)}%{" "}
                        <span className="font-normal text-[#94A3B8]">/ tope {(topeResiduos * 100).toFixed(0)}%</span>
                      </span>
                    </div>
                  )}

                  {defectsShown.length === 0 ? (
                    <p className="text-[13px] text-[#16A34A]">Sin defectos registrados</p>
                  ) : (
                    <div className="space-y-1">
                      {defectsShown.map(([key, pct]) => (
                        <div key={key} className="flex items-center justify-between gap-3 text-[13px]">
                          <span>
                            <span
                              className={`font-semibold ${
                                DEFECT_CAT[key] === "descarte" ? "text-[#DC2626]" : "text-[#16A34A]"
                              }`}
                            >
                              {DEFECT_LABEL[key]}
                            </span>
                            {/* Clasificación (rollup) del defecto — ej. "Residuos de
                                Cosecha", "Otros Defectos Leves" — junto al defecto,
                                sin alterar el alto/alineación de la fila. */}
                            <span className="ml-1 text-[10px] font-normal text-[#94A3B8]">
                              ({DEFECT_CLASIFICACION[key]})
                            </span>
                          </span>
                          <span
                            className={`shrink-0 font-bold ${
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
