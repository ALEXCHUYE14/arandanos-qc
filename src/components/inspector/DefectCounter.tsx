"use client";

import { Minus, Plus } from "lucide-react";
import { NumberInput } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DefectDef } from "@/lib/defects";

/**
 * Contador ergonómico de un defecto: botones grandes − / + y teclado numérico
 * directo. Pensado para uso rápido con guantes en línea de empaque.
 *
 * `onChange` recibe una FUNCIÓN (prev => siguiente), no un número ya
 * calculado — bug real encontrado y confirmado con una prueba automatizada
 * (no solo hipotético): los botones "+"/"−" calculaban el valor siguiente
 * como `value + 1` / `value - 1` usando `value` (la prop de este
 * componente) directamente. Si dos toques seguidos llegaban a procesarse
 * antes de que React alcanzara a re-renderizar entre uno y otro (posible
 * con toques muy rápidos o un "doble toque fantasma" del táctil), los DOS
 * cálculos partían del MISMO `value` viejo — el segundo toque no sumaba
 * sobre el resultado del primero, lo pisaba. Con la función, el cálculo
 * siempre parte del valor más reciente que React tenga en ese instante
 * (se resuelve en la cadena completa: ClamshellEditor → patch() en
 * muestra/[id]/page.tsx), sin importar cuántos toques se acumulen.
 */
export function DefectCounter({
  def,
  value,
  pct,
  onChange,
}: {
  def: DefectDef;
  value: number;
  pct: number; // 0-1
  // Recibe una función que calcula el valor siguiente a partir del ANTERIOR
  // (no un número absoluto ya calculado acá) — ver el porqué, con el bug
  // real que esto corrige, en el comentario grande de más abajo.
  onChange: (updater: (prev: number) => number) => void;
}) {
  const active = value > 0;
  const critical = def.category === "descarte";

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-2 py-1.5",
        active ? (critical ? "border-danger/30 bg-danger/5" : "border-success/30 bg-success/5") : "border-line bg-surface"
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium leading-tight text-ink" title={def.label}>
          {def.label}
        </p>
        {active && (
          <p className={cn("text-[11px] font-semibold", critical ? "text-danger" : "text-success")}>
            {(pct * 100).toFixed(2)}%
          </p>
        )}
      </div>

      <button
        type="button"
        aria-label={`Restar ${def.label}`}
        onClick={() => onChange((prev) => Math.max(0, prev - 1))}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-ink active:scale-95 disabled:opacity-40"
        disabled={value <= 0}
      >
        <Minus className="h-5 w-5" />
      </button>

      {/* NumberInput (no un <input> directo): evita que, al borrar el campo
          para corregir el número, se confirme un "0" intermedio como si
          fuera el conteo final — ver el bug real que esto corrige en
          components/ui/input.tsx. `onCommit` da un número ABSOLUTO (lo que
          el inspector tipeó) — se envuelve en un updater que lo ignora al
          `prev` y devuelve directamente ese número. */}
      <NumberInput
        min={0}
        value={value}
        onCommit={(n) => onChange(() => n)}
        placeholder="0"
        className="no-spin h-10 w-12 shrink-0 rounded-md border border-line bg-surface text-center text-base font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-brand"
      />

      <button
        type="button"
        aria-label={`Sumar ${def.label}`}
        onClick={() => onChange((prev) => prev + 1)}
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-white active:scale-95",
          critical ? "bg-danger" : "bg-brand"
        )}
      >
        <Plus className="h-5 w-5" />
      </button>
    </div>
  );
}
