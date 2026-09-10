"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Input, Label, Select } from "@/components/ui/input";
import { Autocomplete } from "./Autocomplete";
import { getCatalogoByExtra, getBayasEvaluadasDefault, recordarCatalogoValor } from "@/lib/db";
import { isoWeek } from "@/lib/utils";
import type { Muestra } from "@/lib/types";

/** Debounce del autocompletado por DNI (ms) — evita una consulta a IndexedDB
 *  por cada tecla mientras el inspector todavía está escribiendo el DNI. */
const DNI_DEBOUNCE_MS = 350;

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

  // La búsqueda por DNI está debounced (dispara ~350ms después de la última
  // tecla, no en cada tecla) — para cuando dispare, `m` del closure original
  // puede estar obsoleto si el inspector ya tocó otro campo mientras tanto.
  // Este ref siempre tiene la versión más reciente, así el autocompletado
  // nunca pisa un cambio hecho durante la espera del debounce.
  const mRef = useRef(m);
  useEffect(() => {
    mRef.current = m;
  }, [m]);

  const faltantes = useMemo(
    () => CAMPOS_OBLIGATORIOS.filter((c) => !String(m[c.key] ?? "").trim()),
    [m]
  );

  // "DNI no encontrado en el catálogo" — solo para mostrar un aviso claro al
  // inspector (personal nuevo, o DNI mal tipeado); nunca bloquea nada.
  const [dniNoEncontrado, setDniNoEncontrado] = useState<{ inspector: boolean; empacador: boolean }>({
    inspector: false,
    empacador: false,
  });

  // Timers del debounce de búsqueda por DNI (uno por campo, para que tipear
  // en "DNI inspector" no cancele una búsqueda en curso de "DNI empacador").
  const dniTimers = useRef<Partial<Record<"inspector" | "empacador", ReturnType<typeof setTimeout>>>>({});
  useEffect(() => {
    const timers = dniTimers.current;
    return () => {
      // Limpia cualquier búsqueda pendiente si el formulario se desmonta
      // (ej. el inspector cambia de pestaña/muestra) antes de que dispare.
      Object.values(timers).forEach((t) => t && clearTimeout(t));
    };
  }, []);

  // Semana: se recalcula sola a partir de la fecha de empaque (la fecha que
  // más importa para el correlativo semanal del maestro). El inspector puede
  // seguir tocándola a mano después si hace falta un ajuste puntual.
  function onFechaEmpaqueChange(fecha: string) {
    const semana = fecha ? isoWeek(new Date(`${fecha}T00:00:00`)) : m.semana;
    onChange({ ...m, fechaEmpaque: fecha, semana });
  }

  // Autocompleta Apellidos y Nombre a partir del DNI, buscando con debounce
  // en el catálogo local sembrado desde la hoja EMPACADORES / INSPECTORES DE
  // CALIDAD del Excel de referencia (ver lib/listaMaestra.ts →
  // seedListaMaestra en lib/db.ts) — no hay ni necesita haber una API
  // externa: este catálogo YA ES la fuente de datos de personal, y buscarlo
  // local (no por red) es lo que permite que el autocompletado funcione sin
  // señal en la línea de empaque, que es un requisito de fondo de toda la app.
  //
  // Antes esto se saltaba si el campo de nombre ya tenía algo cargado ("no
  // pisa un nombre ya cargado") — funcionaba bien para Empacador (arranca
  // vacío en una muestra nueva) pero rompía el autocompletado de Inspector
  // de Calidad: ese campo arranca PRE-cargado con el nombre del inspector
  // autenticado que creó la muestra (ver createMuestra en useMuestras.ts),
  // así que la guarda bloqueaba la búsqueda desde el primer DNI tipeado, sin
  // importar de quién fuera. Ahora, si el DNI tipeado coincide con un
  // registro del catálogo, el nombre SIEMPRE se sincroniza con ese
  // registro — es una acción explícita del inspector (tipear un DNI válido),
  // y así funciona igual para cualquier inspector, no solo en una muestra
  // recién creada. Si el DNI no está registrado (personal nuevo, un DNI mal
  // tipeado, o falla la búsqueda), NO rompe nada: se avisa con un mensaje y
  // el nombre existente se deja tal cual, sin bloquear el guardado.
  function onDniChange(
    tipo: "inspector" | "empacador",
    dni: string,
    nombreKey: "inspector" | "empacador",
    dniKey: "dniInspector" | "dniEmpacador"
  ) {
    // El valor tipeado se refleja de inmediato (no debounced) — solo la
    // búsqueda/autocompletado en el catálogo espera el debounce.
    onChange({ ...m, [dniKey]: dni });
    setDniNoEncontrado((s) => ({ ...s, [tipo]: false }));

    const timerPrevio = dniTimers.current[tipo];
    if (timerPrevio) clearTimeout(timerPrevio);
    if (!dni.trim()) return;

    dniTimers.current[tipo] = setTimeout(async () => {
      try {
        const match = await getCatalogoByExtra(tipo, dni);
        if (match) {
          onChange({ ...mRef.current, [dniKey]: dni, [nombreKey]: match.valor });
        } else if (dni.trim().length >= 8) {
          // Recién avisa cuando el DNI ya está completo (8 dígitos), para no
          // mostrar el aviso mientras el inspector todavía lo está tipeando.
          setDniNoEncontrado((s) => ({ ...s, [tipo]: true }));
        }
      } catch (err) {
        // Fallo inesperado de IndexedDB: no debe tumbar el formulario ni
        // perder lo ya tipeado, solo queda sin autocompletar el nombre.
        console.error("[Autocompletado DNI] no se pudo buscar en el catálogo", tipo, err);
      }
    }, DNI_DEBOUNCE_MS);
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
          <Autocomplete
            label="Planta de Empaque"
            tipo="planta_empaque"
            value={m.plantaEmpaque}
            onChange={(v) => set("plantaEmpaque", v)}
          />
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
          <Autocomplete label="Intervalo de cosecha" tipo="intervalo_cosecha" value={m.intervaloCosecha} onChange={(v) => set("intervaloCosecha", v)} />
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
            <Label>Peso bruto establecido</Label>
            <Input
              type="text"
              placeholder="ej. 18.5g, o el desglose por clamshell"
              value={m.pesoEstablecido ?? ""}
              onChange={(e) => set("pesoEstablecido", e.target.value === "" ? null : e.target.value)}
            />
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
            extra={m.dniInspector}
          />
          <div>
            <Label>DNI inspector</Label>
            <Input
              inputMode="numeric"
              value={m.dniInspector}
              placeholder="Autocompleta el nombre si ya existe"
              onChange={(e) => onDniChange("inspector", e.target.value, "inspector", "dniInspector")}
              // Si el DNI se completa DESPUÉS del nombre (orden inverso al
              // habitual), este blur vuelve a guardar el par nombre+DNI con
              // el DNI ya puesto — el blur del campo Nombre (Autocomplete)
              // pudo haber disparado antes, con el DNI todavía vacío.
              onBlur={() => {
                if (m.inspector.trim() && m.dniInspector.trim()) {
                  recordarCatalogoValor("inspector", m.inspector, m.dniInspector).catch((err) =>
                    console.error("[DNI inspector] no se pudo recordar", err)
                  );
                }
              }}
            />
            {dniNoEncontrado.inspector && (
              <p className="mt-1 text-[11px] text-warning">
                DNI no registrado — se puede completar el nombre a mano.
              </p>
            )}
          </div>
          <Autocomplete label="Supervisor de producción" tipo="supervisor" value={m.supervisor} onChange={(v) => set("supervisor", v)} />
          <Autocomplete label="Línea de empaque" tipo="linea" value={m.linea} onChange={(v) => set("linea", v)} />
          <Autocomplete
            label="Empacador *"
            tipo="empacador"
            value={m.empacador}
            onChange={onEmpacadorChange}
            onPick={(dni) => dni && set("dniEmpacador", dni)}
            extra={m.dniEmpacador}
          />
          <div>
            <Label>DNI empacador</Label>
            <Input
              inputMode="numeric"
              value={m.dniEmpacador}
              placeholder="Autocompleta el nombre si ya existe"
              onChange={(e) => onDniChange("empacador", e.target.value, "empacador", "dniEmpacador")}
              // Mismo motivo que en DNI inspector: cubre el caso de cargar el
              // DNI después del nombre.
              onBlur={() => {
                if (m.empacador.trim() && m.dniEmpacador.trim()) {
                  recordarCatalogoValor("empacador", m.empacador, m.dniEmpacador).catch((err) =>
                    console.error("[DNI empacador] no se pudo recordar", err)
                  );
                }
              }}
            />
            {dniNoEncontrado.empacador && (
              <p className="mt-1 text-[11px] text-warning">
                DNI no registrado — se puede completar el nombre a mano.
              </p>
            )}
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
          <div>
            {/* Nota manual de la muestra completa — reemplaza, para mostrar en
                la cabecera y en el reporte, al badge automático "CUMPLE"/"NO
                CUMPLE". Solo acepta 5, 15, o en blanco (todavía sin definir,
                cae al valor automático — ver muestra/[id]/page.tsx y
                ReportView.tsx). No cambia el cálculo de defectos/tolerancias
                ni la nota de cada Clamshell (cs.nota, sigue igual). */}
            <Label>Nota</Label>
            <Select
              value={m.notaManual === null ? "" : String(m.notaManual)}
              onChange={(e) => set("notaManual", e.target.value === "" ? null : parseInt(e.target.value, 10))}
            >
              <option value="">— (automático)</option>
              <option value="5">5</option>
              <option value="15">15</option>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Observaciones (muestra)</Label>
            <Input value={m.observaciones} placeholder="Medidas correctivas o notas al pie del reporte…" onChange={(e) => set("observaciones", e.target.value)} />
          </div>
        </div>
      </section>
    </div>
  );
}
