"use client";

import { useId } from "react";
import { Input, Label } from "@/components/ui/input";
import { useCatalogo } from "@/hooks/useMuestras";

/**
 * Campo de texto con autocompletado alimentado por el catálogo cacheado
 * (inspectores, empacadores, supervisores, clientes, etc.).
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
  const listId = useId();
  const opciones = useCatalogo(tipo) ?? [];

  return (
    <div>
      <Label>{label}</Label>
      <Input
        list={listId}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v);
          const match = opciones.find((o) => o.valor === v);
          if (match && onPick) onPick(match.extra);
        }}
      />
      <datalist id={listId}>
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor} />
        ))}
      </datalist>
    </div>
  );
}
