"use client";

import { Input, Label, Select } from "@/components/ui/input";
import { Autocomplete } from "./Autocomplete";
import type { Muestra } from "@/lib/types";

/** Formulario de cabecera del lote/muestra. */
export function MuestraHeaderForm({
  m,
  onChange,
}: {
  m: Muestra;
  onChange: (m: Muestra) => void;
}) {
  const set = <K extends keyof Muestra>(k: K, v: Muestra[K]) => onChange({ ...m, [k]: v });

  return (
    <div className="space-y-5">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Lote / Trazabilidad</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <Label>Semana</Label>
            <Input type="number" className="no-spin" value={m.semana ?? ""} onChange={(e) => set("semana", e.target.value === "" ? null : parseInt(e.target.value, 10))} />
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
            <Input type="date" value={m.fechaEmpaque ?? ""} onChange={(e) => set("fechaEmpaque", e.target.value)} />
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
          <Autocomplete label="Cliente" tipo="cliente" value={m.cliente} onChange={(v) => set("cliente", v)} />
          <Autocomplete label="Destino" tipo="destino" value={m.destino} onChange={(v) => set("destino", v)} />
          <Autocomplete label="Variedad" tipo="variedad" value={m.variedad} onChange={(v) => set("variedad", v)} />
          <Autocomplete label="Formato" tipo="formato" value={m.formato} onChange={(v) => set("formato", v)} />
          <Autocomplete label="Calibre" tipo="calibre" value={m.calibre} onChange={(v) => set("calibre", v)} />
          <div>
            <Label>Peso establecido (g)</Label>
            <Input type="number" className="no-spin" value={m.pesoEstablecido ?? ""} onChange={(e) => set("pesoEstablecido", e.target.value === "" ? null : parseFloat(e.target.value))} />
          </div>
          <Autocomplete label="Embalaje caja" tipo="embalaje_caja" value={m.embalajeCaja} onChange={(v) => set("embalajeCaja", v)} />
          <Autocomplete label="Embalaje clamshell" tipo="embalaje_clamshell" value={m.embalajeClamshell} onChange={(v) => set("embalajeClamshell", v)} />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Personal</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Autocomplete label="Inspector de calidad" tipo="inspector" value={m.inspector} onChange={(v) => set("inspector", v)} onPick={(dni) => dni && set("dniInspector", dni)} />
          <div>
            <Label>DNI inspector</Label>
            <Input inputMode="numeric" value={m.dniInspector} onChange={(e) => set("dniInspector", e.target.value)} />
          </div>
          <Autocomplete label="Supervisor de producción" tipo="supervisor" value={m.supervisor} onChange={(v) => set("supervisor", v)} />
          <div>
            <Label>Línea de empaque</Label>
            <Input value={m.linea} onChange={(e) => set("linea", e.target.value)} />
          </div>
          <Autocomplete label="Empacador" tipo="empacador" value={m.empacador} onChange={(v) => set("empacador", v)} onPick={(dni) => dni && set("dniEmpacador", dni)} />
          <div>
            <Label>DNI empacador</Label>
            <Input inputMode="numeric" value={m.dniEmpacador} onChange={(e) => set("dniEmpacador", e.target.value)} />
          </div>
        </div>
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
