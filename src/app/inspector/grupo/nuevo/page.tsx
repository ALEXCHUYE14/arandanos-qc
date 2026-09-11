"use client";

/**
 * "Nuevo grupo de especificaciones" (carpeta) — el inspector carga UNA VEZ
 * Cliente/Destino/Variedad/Formato/etc. y, a partir de acá, cada muestra
 * nueva que agregue DENTRO de este grupo los hereda automáticamente (ver
 * crearGrupoNuevo/createMuestra en hooks/useMuestras.ts) — solo tiene que
 * completar Empacador/DNI/evaluación para cada uno de los ~40 empacadores
 * de la línea, sin repetir las Especificaciones cada vez.
 */

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Autocomplete } from "@/components/inspector/Autocomplete";
import { crearGrupoNuevo } from "@/hooks/useMuestras";
import type { GrupoEspecificaciones } from "@/lib/types";

const VACIO: GrupoEspecificaciones = {
  cliente: "",
  destino: "",
  variedad: "",
  formato: "",
  tipoEmpaque: "",
  calibre: "",
  embalajeCaja: "",
  embalajeClamshell: "",
  pesoEstablecido: null,
  productor: "",
  plantaEmpaque: "",
  linea: "",
  intervaloCosecha: "",
  turno: "DÍA",
};

export default function NuevoGrupoPage() {
  const router = useRouter();
  const [specs, setSpecs] = useState<GrupoEspecificaciones>(VACIO);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Traba de verdad (no el estado `creando` de arriba, que solo maneja el
  // texto del botón): un `ref` cambia de valor al instante, en el mismo
  // tick — así, si dos toques llegan pegados (antes de que React vuelva a
  // pintar el botón ya deshabilitado), el segundo todavía ve la traba en
  // `true` y se corta acá, sin llegar a crear un grupo de más.
  const creandoRef = useRef(false);

  const set = <K extends keyof GrupoEspecificaciones>(k: K, v: GrupoEspecificaciones[K]) =>
    setSpecs((prev) => ({ ...prev, [k]: v }));

  async function crear() {
    if (creandoRef.current) return;
    creandoRef.current = true;
    setCreando(true);
    setError(null);
    try {
      const grupo = await crearGrupoNuevo(specs);
      router.push(`/inspector/grupo/${grupo.id}`);
      // A propósito NO se libera la traba acá: recién se creó el grupo y ya
      // se disparó la navegación de salida. Este era el bug real ("puse 1
      // especificación y se repite"): antes, un `finally` volvía a habilitar
      // el botón de inmediato, mientras la navegación todavía estaba en
      // curso — un segundo toque en esa breve ventana (típico si la pantalla
      // tarda un instante en cambiar) volvía a ejecutar crear() con las
      // MISMAS especificaciones todavía cargadas en el formulario, armando
      // un grupo duplicado. Si la navegación fallara igual se queda en esta
      // pantalla con el botón deshabilitado — mejor eso que duplicar.
    } catch (err) {
      console.error("[Nuevo grupo] no se pudo crear", err);
      setError("No se pudo crear el grupo. Probá de nuevo.");
      creandoRef.current = false;
      setCreando(false);
    }
  }

  return (
    <main className="px-4 py-4 pb-24">
      <div className="mb-4">
        <Link href="/inspector" className="mb-1 flex items-center gap-1 text-xs text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Mis muestras
        </Link>
        <h1 className="text-xl font-bold text-ink">Nuevo grupo de especificaciones</h1>
        <p className="text-xs text-muted">
          Cargá esto una sola vez — cada muestra que agregues después, dentro de este grupo, ya
          arranca con estos datos. Solo vas a tener que completar Empacador/DNI/evaluación por cada uno.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-5 p-4">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Lote / Trazabilidad</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Autocomplete
                label="Planta de Empaque"
                tipo="planta_empaque"
                value={specs.plantaEmpaque}
                onChange={(v) => set("plantaEmpaque", v)}
              />
              <div>
                <Label>Turno</Label>
                <Select value={specs.turno} onChange={(e) => set("turno", e.target.value as GrupoEspecificaciones["turno"])}>
                  <option value="DÍA">DÍA</option>
                  <option value="NOCHE">NOCHE</option>
                </Select>
              </div>
              <Autocomplete
                label="Intervalo de cosecha"
                tipo="intervalo_cosecha"
                value={specs.intervaloCosecha}
                onChange={(v) => set("intervaloCosecha", v)}
              />
              <Autocomplete label="Productor" tipo="productor" value={specs.productor} onChange={(v) => set("productor", v)} />
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Especificaciones</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Autocomplete label="Cliente" tipo="cliente" value={specs.cliente} onChange={(v) => set("cliente", v)} />
              <Autocomplete label="Destino" tipo="destino" value={specs.destino} onChange={(v) => set("destino", v)} />
              <Autocomplete label="Variedad" tipo="variedad" value={specs.variedad} onChange={(v) => set("variedad", v)} />
              <Autocomplete label="Formato" tipo="formato" value={specs.formato} onChange={(v) => set("formato", v)} />
              <Autocomplete
                label="Tipo de empaque"
                tipo="tipo_empaque"
                value={specs.tipoEmpaque}
                onChange={(v) => set("tipoEmpaque", v)}
              />
              <Autocomplete label="Calibre" tipo="calibre" value={specs.calibre} onChange={(v) => set("calibre", v)} />
              <div>
                <Label>Peso bruto establecido</Label>
                <Input
                  type="text"
                  placeholder="ej. 18.5g, o el desglose por clamshell"
                  value={specs.pesoEstablecido ?? ""}
                  onChange={(e) => set("pesoEstablecido", e.target.value === "" ? null : e.target.value)}
                />
              </div>
              <Autocomplete
                label="Embalaje caja"
                tipo="embalaje_caja"
                value={specs.embalajeCaja}
                onChange={(v) => set("embalajeCaja", v)}
              />
              <Autocomplete
                label="Etiqueta clamshell"
                tipo="embalaje_clamshell"
                value={specs.embalajeClamshell}
                onChange={(v) => set("embalajeClamshell", v)}
              />
              <Autocomplete label="Línea de empaque" tipo="linea" value={specs.linea} onChange={(v) => set("linea", v)} />
            </div>
          </section>

          {error && (
            <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
              {error}
            </p>
          )}

          <Button onClick={crear} disabled={creando} size="lg" className="w-full">
            <FolderPlus className="h-5 w-5" /> {creando ? "Creando…" : "Crear grupo y empezar a agregar muestras"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
