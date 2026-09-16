"use client";

import { Minus, Plus } from "lucide-react";
import { NumberInput } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DefectDef } from "@/lib/defects";

/**
 * Contador ergonómico de un defecto: botones grandes − / + y teclado numérico
 * directo. Pensado para uso rápido con guantes en línea de empaque.
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
  onChange: (v: number) => void;
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
        onClick={() => onChange(Math.max(0, value - 1))}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-ink active:scale-95 disabled:opacity-40"
        disabled={value <= 0}
      >
        <Minus className="h-5 w-5" />
      </button>

      {/* NumberInput (no un <input> directo): evita que, al borrar el campo
          para corregir el número, se confirme un "0" intermedio como si
          fuera el conteo final — ver el bug real que esto corrige en
          components/ui/input.tsx. */}
      <NumberInput
        min={0}
        value={value}
        onCommit={onChange}
        placeholder="0"
        className="no-spin h-10 w-12 shrink-0 rounded-md border border-line bg-surface text-center text-base font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-brand"
      />

      <button
        type="button"
        aria-label={`Sumar ${def.label}`}
        onClick={() => onChange(value + 1)}
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
