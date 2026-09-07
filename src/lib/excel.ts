/**
 * EXPORTACIÓN E INTEGRACIÓN CON EXCEL — sin descuadres.
 *
 * 1) copyMuestraToClipboard / copyManyToClipboard:
 *    Genera las filas en las 124 columnas exactas, delimitadas por TAB, y las
 *    copia al portapapeles. Al hacer Ctrl+V sobre la primera celda de datos de
 *    la hoja "Base de Datos", cada valor cae en su columna sin mover encabezados.
 *
 * 2) downloadXlsx:
 *    Descarga un .xlsx nativo con la hoja "Base de Datos" (124 columnas + datos)
 *    y reproduce las hojas secundarias "Tolerancias" y "Control de Cambios".
 */

import * as XLSX from "xlsx";
import { HEADERS_124, buildMuestraRows, rowsToTSV } from "./columns";
import { TOLERANCES, TOLERANCE_SUMA } from "./defects";
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
  const aoa: (string | number)[][] = [HEADERS_124.map((h) => h.replace(/\n/g, " ")), ...dataRows];
  const wsData = XLSX.utils.aoa_to_sheet(aoa);
  wsData["!cols"] = HEADERS_124.map(() => ({ wch: 16 }));
  XLSX.utils.book_append_sheet(wb, wsData, "Base de Datos");

  // ── Hoja "Tolerancias" ────────────────────────────────────────────────
  const tolAoa: (string | number)[][] = [
    ["CATEGORÍA", "% MÁXIMO", "REGLA"],
    ...TOLERANCES.map((t) => [t.label, t.max, `<= ${(t.max * 100).toFixed(2)}% = CUMPLE`]),
    [TOLERANCE_SUMA.label, TOLERANCE_SUMA.max, `<= ${(TOLERANCE_SUMA.max * 100).toFixed(2)}% = CUMPLE`],
    [],
    ["Nota", "NOTA = 15 equivale a CUMPLE en ESTÁNDAR /CLAMSHELL"],
  ];
  const wsTol = XLSX.utils.aoa_to_sheet(tolAoa);
  XLSX.utils.book_append_sheet(wb, wsTol, "Tolerancias");

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
