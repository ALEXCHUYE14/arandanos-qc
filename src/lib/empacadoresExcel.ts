/**
 * EXPORTAR / IMPORTAR EMPACADORES EN EXCEL (/dashboard/empacadores).
 *
 * Estructura de columnas del archivo (la misma que la tabla public.empacadores):
 *   NOMBRE | DNI | ACTIVO
 *   - Primera fila = encabezados (se aceptan variantes: "Nombre completo",
 *     "Estado", etc., sin distinguir mayúsculas ni tildes).
 *   - NOMBRE: obligatorio. Se guarda en MAYÚSCULAS, igual que el alta manual.
 *   - DNI: obligatorio, 6 a 12 dígitos, como TEXTO en Excel (un DNI con cero
 *     inicial guardado como número pierde ese cero).
 *   - ACTIVO: opcional. SI/NO (también acepta TRUE/FALSE, 1/0). Celda vacía = SI.
 *     Si la columna no existe, el archivo NO toca el estado de los que ya
 *     están cargados (solo crea los nuevos como activos).
 *
 * La lectura es PURA: devuelve filas válidas y lista de errores; no escribe
 * nada. Quien llama solo guarda si no hubo ningún error — así un archivo con
 * un DNI mal escrito nunca deja la lista a medio importar.
 */

import * as XLSX from "xlsx";

export interface EmpacadorExcel {
  nombre: string;
  dni: string;
  activo: boolean;
}

export interface ResultadoImportExcel {
  filas: EmpacadorExcel[];
  errores: string[];
  /** true si el archivo trae la columna ACTIVO (si no, no se toca el estado existente). */
  tieneColumnaActivo: boolean;
}

export const MAX_FILAS_IMPORT = 2000;
const DNI_RE = /^[0-9]{6,12}$/;
const MAX_ERRORES_MOSTRADOS = 50;

const ALIAS_NOMBRE = ["nombre", "nombres", "nombre completo", "apellidos y nombre", "apellidos y nombres"];
const ALIAS_DNI = ["dni"];
const ALIAS_ACTIVO = ["activo", "estado"];
const VALORES_SI = ["si", "s", "true", "1", "x", "activo"];
const VALORES_NO = ["no", "n", "false", "0", "de baja", "inactivo"];

/** Minúsculas, sin tildes ni espacios sobrantes: "Sí " → "si", "NOMBRE COMPLETO" → "nombre completo". */
function normalizar(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Lee el .xlsx (primera hoja) y valida cada fila. No escribe nada. */
export function parsearEmpacadoresXlsx(buffer: ArrayBuffer): ResultadoImportExcel {
  const errores: string[] = [];
  const filas: EmpacadorExcel[] = [];

  const wb = XLSX.read(buffer, { type: "array" });
  const primeraHoja = wb.SheetNames[0];
  if (!primeraHoja) {
    return { filas, errores: ["El archivo no tiene hojas."], tieneColumnaActivo: false };
  }
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[primeraHoja], {
    header: 1,
    defval: "",
    raw: true,
    blankrows: false,
  });
  if (aoa.length === 0) {
    return { filas, errores: ["El archivo está vacío."], tieneColumnaActivo: false };
  }

  const encabezados = aoa[0].map(normalizar);
  const idxNombre = encabezados.findIndex((h) => ALIAS_NOMBRE.includes(h));
  const idxDni = encabezados.findIndex((h) => ALIAS_DNI.includes(h));
  const idxActivo = encabezados.findIndex((h) => ALIAS_ACTIVO.includes(h));
  const tieneColumnaActivo = idxActivo >= 0;

  if (idxNombre < 0 || idxDni < 0) {
    return {
      filas,
      errores: ["En la primera fila tienen que estar las columnas NOMBRE y DNI (ACTIVO es opcional)."],
      tieneColumnaActivo,
    };
  }

  const dnisVistos = new Map<string, number>();

  for (let i = 1; i < aoa.length; i++) {
    const fila = aoa[i];
    const nFila = i + 1; // número de fila en Excel (la 1 son los encabezados)
    const celda = (idx: number) => (idx >= 0 ? fila[idx] : "");

    const nombreRaw = String(celda(idxNombre) ?? "").replace(/\s+/g, " ").trim();
    const dniCelda = celda(idxDni);
    const dniRaw =
      typeof dniCelda === "number"
        ? Number.isInteger(dniCelda)
          ? String(dniCelda)
          : ""
        : String(dniCelda ?? "").replace(/\s+/g, "").trim();
    const activoRaw = normalizar(celda(idxActivo));

    // Fila completamente vacía: se ignora (Excel suele dejar filas en blanco).
    if (!nombreRaw && !dniRaw && !activoRaw) continue;

    let filaOk = true;
    if (!nombreRaw) {
      errores.push(`Fila ${nFila}: falta el NOMBRE.`);
      filaOk = false;
    }
    if (!DNI_RE.test(dniRaw)) {
      errores.push(
        `Fila ${nFila}: DNI "${dniRaw || String(dniCelda ?? "")}" no válido (6 a 12 números, sin puntos ni letras; si Excel lo cambia, formateá la columna DNI como Texto).`
      );
      filaOk = false;
    }

    let activo = true;
    if (tieneColumnaActivo && activoRaw !== "") {
      if (VALORES_SI.includes(activoRaw)) activo = true;
      else if (VALORES_NO.includes(activoRaw)) activo = false;
      else {
        errores.push(`Fila ${nFila}: ACTIVO "${String(celda(idxActivo))}" no válido (usá SI o NO).`);
        filaOk = false;
      }
    }

    if (filaOk) {
      const previa = dnisVistos.get(dniRaw);
      if (previa !== undefined) {
        errores.push(`Fila ${nFila}: el DNI ${dniRaw} ya aparece en la fila ${previa} del archivo.`);
      } else {
        dnisVistos.set(dniRaw, nFila);
        filas.push({ nombre: nombreRaw.toUpperCase(), dni: dniRaw, activo });
      }
    }
  }

  if (filas.length + errores.length === 0) {
    errores.push("El archivo no tiene filas de empacadores debajo de los encabezados.");
  }
  if (filas.length + errores.length > MAX_FILAS_IMPORT) {
    errores.push(`El archivo tiene más de ${MAX_FILAS_IMPORT} filas — dividilo en partes más chicas.`);
  }
  if (errores.length > MAX_ERRORES_MOSTRADOS) {
    const resto = errores.length - MAX_ERRORES_MOSTRADOS;
    errores.length = MAX_ERRORES_MOSTRADOS;
    errores.push(`… y ${resto} error(es) más.`);
  }

  return { filas, errores, tieneColumnaActivo };
}

/** Descarga la lista completa (activos y de baja) con las mismas columnas que se importan. */
export function descargarEmpacadoresXlsx(lista: { nombre: string; dni: string; activo: boolean }[]) {
  const aoa: (string | number)[][] = [
    ["NOMBRE", "DNI", "ACTIVO"],
    ...lista.map((e) => [e.nombre, e.dni, e.activo ? "SI" : "NO"]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 42 }, { wch: 14 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Empacadores");
  const hoy = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Empacadores_${hoy}.xlsx`);
}
