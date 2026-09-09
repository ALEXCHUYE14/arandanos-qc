"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
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

  // Cierra el dropdown al tocar/hacer clic fuera del campo.
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
            const v = e.target.value;
            onChange(v);
            setOpen(true);
            setHighlight(-1);
            // Coincidencia exacta mientras se escribe (ej. autocompletado por
            // código de barras/lector externo que escribe todo de una): mismo
            // comportamiento que tenía el datalist nativo antes.
            const match = opciones.find((o) => o.valor === v);
            if (match && onPick) onPick(match.extra);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
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
            lo enfoca, lo que ya abre el dropdown por el onFocus de arriba. */}
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      </div>
      {open && filtradas.length > 0 && (
        <ul className="absolute z-40 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-line bg-surface py-1 shadow-lg">
          {filtradas.map((o, i) => (
            <li key={o.valor}>
              <button
                type="button"
                // onMouseDown (no onClick) para que dispare ANTES del blur
                // del input — si no, el blur cierra el dropdown primero y el
                // toque/clic en la opción se pierde (típico en móvil).
                onMouseDown={(e) => {
                  e.preventDefault();
                  elegir(o);
                }}
                className={cn(
                  "block w-full truncate px-3 py-2 text-left text-sm text-ink",
                  i === highlight ? "bg-brand/10" : "hover:bg-base"
                )}
              >
                {o.valor}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
