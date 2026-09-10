/**
 * EXPORTACIÓN E INTEGRACIÓN CON EXCEL — sin descuadres.
 *
 * 1) copyMuestraToClipboard / copyManyToClipboard:
 *    Genera las filas en las 130 columnas exactas, delimitadas por TAB, y las
 *    copia al portapapeles. Al hacer Ctrl+V sobre la primera celda de datos de
 *    la hoja "Base de Datos", cada valor cae en su columna sin mover encabezados.
 *
 * 2) downloadXlsx:
 *    Descarga un .xlsx nativo con la hoja "Base de Datos" (130 columnas + datos)
 *    y reproduce las hojas secundarias "Defectos" (tolerancias por destino) y
 *    "Control de Cambios".
 */

import * as XLSX from "xlsx";
import { HEADERS_BASE_DATOS, buildMuestraRows, rowsToTSV } from "./columns";
import { TOLERANCES } from "./defects";
import type { Muestra } from "./types";

/** Copia una muestra (todas sus filas de clamshell) al portapapeles como TSV. */
export async function copyMuestraToClipboard(m: Muestra): Promise<void> {
  const tsv = rowsToTSV(buildMuestraRows(m));
  await writeClipboard(tsv);
}

/** Copia varias muestras acumuladas al portapapeles como TSV. */
export async function copyManyToClipboard(muestras: Muestra[]): Promise<void> {
  const rows = muestras.flatMap(buildMuestraRows);
  await writeClipboard(rowsToTSV(rows));
}

async function writeClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Fallback para contextos no seguros / navegadores antiguos.
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

/** Construye y descarga el .xlsx acumulado. */
export function downloadXlsx(muestras: Muestra[], filename = "Base_de_Datos_Inspeccion_Calidad.xlsx") {
  const wb = XLSX.utils.book_new();

  // ── Hoja "Base de Datos" ──────────────────────────────────────────────
  const dataRows = muestras.flatMap(buildMuestraRows);
  const aoa: (string | number)[][] = [HEADERS_BASE_DATOS.map((h) => h.replace(/\n/g, " ")), ...dataRows];
  const wsData = XLSX.utils.aoa_to_sheet(aoa);
  wsData["!cols"] = HEADERS_BASE_DATOS.map(() => ({ wch: 16 }));
  XLSX.utils.book_append_sheet(wb, wsData, "Base de Datos");

  // ── Hoja "Defectos" (tolerancias por destino) ──────────────────────────
  const tolAoa: (string | number | null)[][] = [
    ["CLASIFICACIÓN", "CHINA", "EUROPA/USA", "USA SWEETEST BATCH", "CHINA + OZBLUE"],
    ...TOLERANCES.map((t) => [t.label, t.china, t.europa_usa, t.usa_sweetest_batch, t.chinaOzblue ?? "—"]),
    [],
    ["Nota", "NOTA = 15 equivale a CUMPLE en ESTÁNDAR /CLAMSHELL"],
    ["Nota", "USA SWEETEST BATCH aplica cuando el destino es USA y el embalaje caja contiene \"SWEETEST BATCH\"; si no, USA usa la columna EUROPA/USA."],
    ["Nota", "CHINA + OZBLUE aplica solo a TAMAÑO cuando el destino es CHINA y el cliente es OZBLUE (más laxo que el tope normal de China); las demás clasificaciones (\"—\") siguen usando la columna CHINA para cualquier cliente."],
  ];
  const wsTol = XLSX.utils.aoa_to_sheet(tolAoa);
  XLSX.utils.book_append_sheet(wb, wsTol, "Defectos");

  // ── Hoja "Control de Cambios" ─────────────────────────────────────────
  const ccAoa: (string | number)[][] = [
    ["Control de Cambios"],
    [],
    ["Versión", "Fecha", "Descripción del Cambio", "Responsable"],
    ["01", "31/07/2026", "Primera emisión del documento", "Coordinador de Calidad — Betsy Crisanto Valdiviezo"],
  ];
  const wsCC = XLSX.utils.aoa_to_sheet(ccAoa);
  XLSX.utils.book_append_sheet(wb, wsCC, "Control de Cambios");

  XLSX.writeFile(wb, filename);
}
