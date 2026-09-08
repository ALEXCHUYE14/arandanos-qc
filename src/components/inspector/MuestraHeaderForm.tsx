"use client";

import { useMemo } from "react";
import { AlertCircle } from "lucide-react";
import { Input, Label, Select } from "@/components/ui/input";
import { Autocomplete } from "./Autocomplete";
import { getCatalogoByExtra, getBayasEvaluadasDefault } from "@/lib/db";
import { isoWeek } from "@/lib/utils";
import type { Muestra } from "@/lib/types";

/**
 * Campos que se consideran obligatorios para una evaluación completa. Se
 * marcan con "*" y se avisa (sin bloquear nada) si faltan — bloquear el
 * guardado rompería el diseño offline-first de la app: un inspector en
 * campo, sin señal, nunca debe perder lo que ya cargó por faltarle un dato
 * que todavía no sabe (ej. el destino final de la caja).
 */
const CAMPOS_OBLIGATORIOS: { key: keyof Muestra; label: string }[] = [
  { key: "cliente", label: "Cliente" },
  { key: "destino", label: "Destino" },
  { key: "variedad", label: "Variedad" },
  { key: "formato", label: "Formato" },
  { key: "calibre", label: "Calibre" },
  { key: "inspector", label: "Inspector de calidad" },
  { key: "empacador", label: "Empacador" },
];

/** Formulario de cabecera del lote/muestra. */
export function MuestraHeaderForm({
  m,
  onChange,
}: {
  m: Muestra;
  onChange: (m: Muestra) => void;
}) {
  const set = <K extends keyof Muestra>(k: K, v: Muestra[K]) => onChange({ ...m, [k]: v });

  const faltantes = useMemo(
    () => CAMPOS_OBLIGATORIOS.filter((c) => !String(m[c.key] ?? "").trim()),
    [m]
  );

  // Semana: se recalcula sola a partir de la fecha de empaque (la fecha que
  // más importa para el correlativo semanal del maestro). El inspector puede
  // seguir tocándola a mano después si hace falta un ajuste puntual.
  function onFechaEmpaqueChange(fecha: string) {
    const semana = fecha ? isoWeek(new Date(`${fecha}T00:00:00`)) : m.semana;
    onChange({ ...m, fechaEmpaque: fecha, semana });
  }

  // Autocompleta el nombre a partir del DNI (además de nombre → DNI, que ya
  // hacía el Autocomplete). Si el DNI no está registrado (personal nuevo),
  // no hace nada — el campo queda en blanco para completarlo después, sin
  // bloquear el guardado de la muestra.
  async function onDniChange(tipo: "inspector" | "empacador", dni: string, nombreKey: "inspector" | "empacador", dniKey: "dniInspector" | "dniEmpacador") {
    onChange({ ...m, [dniKey]: dni });
    if (!dni.trim() || m[nombreKey].trim()) return; // no pisa un nombre ya cargado
    const match = await getCatalogoByExtra(tipo, dni);
    if (match) onChange({ ...m, [dniKey]: dni, [nombreKey]: match.valor });
  }

  // Al elegir un empacador ya conocido, prellena el N° de bayas evaluadas con
  // el que se usó la última vez para ese empacador — casi siempre se repite
  // dentro del mismo lote. Solo si la muestra todavía está "en blanco" (un
  // clamshell, sin ningún conteo cargado): nunca pisa datos ya tomados.
  async function onEmpacadorChange(empacador: string) {
    const esMuestraNueva =
      m.clamshells.length === 1 &&
      m.clamshells[0].nBayasEvaluadas === 99 &&
      Object.values(m.clamshells[0].counts).every((v) => !v);
    if (!esMuestraNueva) {
      set("empacador", empacador);
      return;
    }
    const bayas = await getBayasEvaluadasDefault(empacador);
    if (bayas) {
      onChange({
        ...m,
        empacador,
        clamshells: m.clamshells.map((cs) => ({ ...cs, nBayasEvaluadas: bayas })),
      });
    } else {
      set("empacador", empacador);
    }
  }

  return (
    <div className="space-y-5">
      {faltantes.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Faltan campos obligatorios: <strong>{faltantes.map((c) => c.label).join(", ")}</strong>.
            Se puede seguir guardando mientras se completan.
          </span>
        </div>
      )}

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Lote / Trazabilidad</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <Label>Semana</Label>
            <Input
              type="number"
              className="no-spin"
              value={m.semana ?? ""}
              title="Se calcula sola a partir de la fecha de empaque; se puede ajustar a mano si hace falta."
              onChange={(e) => set("semana", e.target.value === "" ? null : parseInt(e.target.value, 10))}
            />
          </div>
          <div>
            <Label>Hora de evaluación</Label>
            <Input type="time" value={m.horaEvaluacion ?? ""} onChange={(e) => set("horaEvaluacion", e.target.value)} />
          </div>
          <div>
            <Label>N° planta empaque</Label>
            <Input type="number" className="no-spin" value={m.nPlanta ?? ""} onChange={(e) => set("nPlanta", e.target.value === "" ? null : parseInt(e.target.value, 10))} />
          </div>
          <div>
            <Label>Fecha cosecha</Label>
            <Input type="date" value={m.fechaCosecha ?? ""} onChange={(e) => set("fechaCosecha", e.target.value)} />
          </div>
          <div>
            <Label>Fecha empaque</Label>
            <Input type="date" value={m.fechaEmpaque ?? ""} onChange={(e) => onFechaEmpaqueChange(e.target.value)} />
          </div>
          <div>
            <Label>Turno</Label>
            <Select value={m.turno} onChange={(e) => set("turno", e.target.value as Muestra["turno"])}>
              <option value="DÍA">DÍA</option>
              <option value="NOCHE">NOCHE</option>
            </Select>
          </div>
          <div>
            <Label>Intervalo de cosecha</Label>
            <Input value={m.intervaloCosecha} onChange={(e) => set("intervaloCosecha", e.target.value)} />
          </div>
          <Autocomplete label="Productor" tipo="productor" value={m.productor} onChange={(v) => set("productor", v)} />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Especificaciones</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Autocomplete label="Cliente *" tipo="cliente" value={m.cliente} onChange={(v) => set("cliente", v)} />
          <Autocomplete label="Destino *" tipo="destino" value={m.destino} onChange={(v) => set("destino", v)} />
          <Autocomplete label="Variedad *" tipo="variedad" value={m.variedad} onChange={(v) => set("variedad", v)} />
          <Autocomplete label="Formato *" tipo="formato" value={m.formato} onChange={(v) => set("formato", v)} />
          <Autocomplete label="Tipo de empaque" tipo="tipo_empaque" value={m.tipoEmpaque ?? ""} onChange={(v) => set("tipoEmpaque", v)} />
          <Autocomplete label="Calibre *" tipo="calibre" value={m.calibre} onChange={(v) => set("calibre", v)} />
          <div>
            <Label>Peso bruto establecido (g)</Label>
            <Input type="number" className="no-spin" value={m.pesoEstablecido ?? ""} onChange={(e) => set("pesoEstablecido", e.target.value === "" ? null : parseFloat(e.target.value))} />
          </div>
          <Autocomplete label="Embalaje caja" tipo="embalaje_caja" value={m.embalajeCaja} onChange={(v) => set("embalajeCaja", v)} />
          <Autocomplete label="Etiqueta clamshell" tipo="embalaje_clamshell" value={m.embalajeClamshell} onChange={(v) => set("embalajeClamshell", v)} />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Personal</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Autocomplete
            label="Inspector de calidad *"
            tipo="inspector"
            value={m.inspector}
            onChange={(v) => set("inspector", v)}
            onPick={(dni) => dni && set("dniInspector", dni)}
          />
          <div>
            <Label>DNI inspector</Label>
            <Input
              inputMode="numeric"
              value={m.dniInspector}
              placeholder="Autocompleta el nombre si ya existe"
              onChange={(e) => onDniChange("inspector", e.target.value, "inspector", "dniInspector")}
            />
          </div>
          <Autocomplete label="Supervisor de producción" tipo="supervisor" value={m.supervisor} onChange={(v) => set("supervisor", v)} />
          <div>
            <Label>Línea de empaque</Label>
            <Input value={m.linea} onChange={(e) => set("linea", e.target.value)} />
          </div>
          <Autocomplete
            label="Empacador *"
            tipo="empacador"
            value={m.empacador}
            onChange={onEmpacadorChange}
            onPick={(dni) => dni && set("dniEmpacador", dni)}
          />
          <div>
            <Label>DNI empacador</Label>
            <Input
              inputMode="numeric"
              value={m.dniEmpacador}
              placeholder="Autocompleta el nombre si ya existe"
              onChange={(e) => onDniChange("empacador", e.target.value, "empacador", "dniEmpacador")}
            />
          </div>
        </div>
        {(!m.inspector.trim() || !m.empacador.trim()) && (
          <p className="mt-1.5 text-[11px] text-muted">
            Si el DNI o el nombre todavía no están registrados (personal nuevo), se puede dejar en
            blanco y completar más tarde — la muestra se guarda igual.
          </p>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Evaluación</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <Label>Medida correctiva</Label>
            <Select value={m.medidaCorrectiva} onChange={(e) => set("medidaCorrectiva", e.target.value)}>
              <option value="NO">NO</option>
              <option value="SI">SÍ</option>
            </Select>
          </div>
          <div className="sm:col-span-3">
            <Label>Observaciones (muestra)</Label>
            <Input value={m.observaciones} placeholder="Medidas correctivas o notas al pie del reporte…" onChange={(e) => set("observaciones", e.target.value)} />
          </div>
        </div>
      </section>
    </div>
  );
}
