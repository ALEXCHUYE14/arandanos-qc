"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { useCatalogo } from "@/hooks/useMuestras";
import { cn } from "@/lib/utils";

/**
 * Campo de texto con autocompletado alimentado por el catálogo cacheado
 * (inspectores, empacadores, supervisores, clientes, etc.).
 *
 * Dropdown propio en React — NO usa `<input list>` + `<datalist>` nativo.
 * El datalist nativo del navegador no muestra ninguna sugerencia en Safari
 * de iOS (el navegador que usa la mayoría de inspectores en el celular) y
 * su comportamiento es inconsistente en Android — por eso las listas
 * desplegables de Cliente/Destino/Variedad/Empacador/etc. se veían y
 * funcionaban bien en la computadora pero no aparecían en el celular. Este
 * dropdown se dibuja con React y funciona igual en los dos.
 *
 * Sigue siendo un campo de texto libre (no un <select>): se puede escribir
 * cualquier valor que todavía no esté en la lista (personal nuevo, cliente
 * nuevo) sin que nada bloquee el guardado — el dropdown es solo una ayuda.
 *
 * En el celular, al abrirse, se muestra como una hoja de ancho completo
 * desde abajo (mismo estilo que el selector nativo de "Turno") en vez del
 * mismo desplegable angosto que en la computadora — ver `open` más abajo:
 * se renderizan DOS variantes (una por breakpoint, `sm:hidden` / `hidden
 * sm:block`), pero comparten exactamente el mismo estado y las mismas
 * funciones (`elegir`, `filtradas`, etc.), así que el comportamiento real
 * (qué pasa al elegir una opción, qué se guarda) es idéntico en los dos.
 */
export function Autocomplete({
  label,
  tipo,
  value,
  onChange,
  placeholder,
  onPick,
}: {
  label: string;
  tipo: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onPick?: (extra?: string) => void; // p.ej. autocompletar DNI asociado
}) {
  const inputId = useId();
  const opcionesRaw = useCatalogo(tipo);
  const opciones = useMemo(() => opcionesRaw ?? [], [opcionesRaw]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  // Filtra por lo ya escrito (igual que el datalist nativo); si el campo
  // está vacío muestra todas las opciones. Se recorta a 50 para no renderizar
  // listas larguísimas de una (hay catálogos con 200+ empacadores).
  const filtradas = useMemo(() => {
    const q = value.trim().toLowerCase();
    const lista = q ? opciones.filter((o) => o.valor.toLowerCase().includes(q)) : opciones;
    return lista.slice(0, 50);
  }, [opciones, value]);

  // Cierra el dropdown de escritorio al tocar/hacer clic fuera del campo.
  // La hoja de móvil se cierra con su propio fondo/botón "Listo" (más abajo),
  // no con este listener.
  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent | TouchEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("touchstart", onOutside);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("touchstart", onOutside);
    };
  }, [open]);

  function elegir(o: { valor: string; extra?: string }) {
    onChange(o.valor);
    if (onPick) onPick(o.extra);
    setOpen(false);
    setHighlight(-1);
  }

  function onChangeTexto(v: string) {
    onChange(v);
    setHighlight(-1);
    // Coincidencia exacta mientras se escribe (ej. autocompletado por código
    // de barras/lector externo que escribe todo de una): mismo comportamiento
    // que tenía el datalist nativo antes.
    const match = opciones.find((o) => o.valor === v);
    if (match && onPick) onPick(match.extra);
  }

  return (
    <div ref={boxRef} className="relative">
      <Label htmlFor={inputId}>{label}</Label>
      {/* Envoltorio propio (además del boxRef de afuera) solo para que la
          flechita quede centrada sobre el campo de texto y no sobre el
          Label — el dropdown de sugerencias de abajo se sigue posicionando
          contra boxRef, así que esto no le cambia nada a esa parte. */}
      <div className="relative">
        <Input
          id={inputId}
          autoComplete="off"
          className="pr-8"
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            onChangeTexto(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            // La navegación con flechas/Enter es para teclado físico
            // (computadora) — en el celular la hoja de abajo se usa
            // tocando las filas, no hace falta acá.
            if (!open || filtradas.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => Math.min(h + 1, filtradas.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter") {
              if (highlight >= 0 && filtradas[highlight]) {
                e.preventDefault();
                elegir(filtradas[highlight]);
              }
            } else if (e.key === "Escape") {
              setOpen(false);
              setHighlight(-1);
            }
          }}
        />
        {/* Flechita estilo filtro de Excel — mismo criterio que <Select>: solo
            indica visualmente que el campo tiene opciones para elegir. Un
            toque/clic ahí cae sobre el input de abajo (pointer-events-none) y
            lo enfoca, lo que ya abre el dropdown/hoja por el onFocus de arriba. */}
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      </div>

      {/* ── Escritorio (>= sm): el mismo desplegable angosto de siempre ── */}
      {open && filtradas.length > 0 && (
        <ul className="absolute z-40 mt-1 hidden max-h-56 w-full overflow-y-auto rounded-md border border-line bg-surface py-1 shadow-lg sm:block">
          {filtradas.map((o, i) => (
            <li key={o.valor}>
              <button
                type="button"
                // onMouseDown (no onClick) para que dispare ANTES del blur
                // del input — si no, el blur cierra el dropdown primero y el
                // clic en la opción se pierde.
                onMouseDown={(e) => {
                  e.preventDefault();
                  elegir(o);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-2 truncate px-3 py-2 text-left text-sm text-ink",
                  i === highlight ? "bg-brand/10" : "hover:bg-base"
                )}
              >
                <span className="truncate">{o.valor}</span>
                {o.valor === value && <Check className="h-4 w-4 shrink-0 text-brand" />}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* ── Celular (< sm): hoja completa desde abajo, mismo estilo que el
          selector nativo de "Turno" (fondo oscuro, filas grandes, check en
          la opción elegida) ── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/50 sm:hidden"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="safe-bottom flex max-h-[80vh] w-full flex-col rounded-t-2xl bg-[#1F2430] text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-white/10 p-3">
              <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-white/60">{label}</p>
              <input
                autoFocus
                autoComplete="off"
                inputMode="text"
                value={value}
                placeholder={placeholder || "Buscar o escribir…"}
                onChange={(e) => onChangeTexto(e.target.value)}
                className="w-full rounded-md border border-white/15 bg-white/10 px-3 py-2.5 text-[15px] text-white placeholder-white/40 outline-none focus:border-white/30"
              />
            </div>
            <ul className="flex-1 overflow-y-auto py-1">
              {filtradas.map((o) => (
                <li key={o.valor}>
                  <button
                    type="button"
                    onClick={() => elegir(o)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-[15px] active:bg-white/10"
                  >
                    <span className="truncate">{o.valor}</span>
                    {/* Blanco (no text-brand): el azul del tema es para fondos
                        claros, acá el fondo es oscuro y perdía contraste. */}
                    {o.valor === value && <Check className="h-5 w-5 shrink-0 text-white" />}
                  </button>
                </li>
              ))}
              {filtradas.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-white/50">
                  {value.trim()
                    ? `Sin coincidencias — se guarda "${value.trim()}" tal como lo escribiste.`
                    : "Sin opciones todavía — escribí para cargar un valor nuevo."}
                </li>
              )}
            </ul>
            <div className="border-t border-white/10 p-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full rounded-md bg-white/10 py-2.5 text-center text-sm font-semibold active:bg-white/20"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
