/**
 * DATOS DE REFERENCIA — hoja "Lista Maestra" del Excel del cliente
 * (docs/referencia-cliente/BH-F-CCA-006. Base de Datos de la Inspección de la
 * Calidad en PT - Línea de Empaque (1).xlsx).
 *
 * Extraídos 1:1 de esa hoja (columnas A:V) para sembrar el autocompletado de
 * "Nueva muestra" con las opciones reales del cliente, en vez de depender de
 * que alguien las haya tipeado antes a mano en ESE dispositivo puntual. Se
 * usan en lib/db.ts → seedListaMaestra().
 *
 * Los textos se dejan tal cual salieron del Excel (con algún espacio de más
 * que trae el archivo original); seedListaMaestra() los recorta al sembrar.
 */

export const LISTA_MAESTRA = {
  clientes: ["PENGSHENG", "OZBLUE", "DRISCOLL´S", "BERRIES PRIDE BV"],

  destinos: ["CHINA", "USA", "EUROPA"],

  formatos: ["4.4 oz", "6 oz", "11 oz", "18 oz"],

  calibres: ["12 MM+", "14 MM+", "16 MM+", "18 MM+", "20 MM+"],

  tiposEmpaque: ["CONVENCIONAL", "JUMBO"],

  embalajesCaja: [
    "ALWAYS FRESH",
    "BERRY BOOM",
    "BERRY TASTY ROJA",
    "BERRY PRINCESS",
    "BERRY VALLEY",
    "BLUE BERRY",
    "DRISCOLL´S",
    "DRISCOLL´S SWEETEST BATCH",
    "DELIGHT BERRY VERDE",
    "DELIGHT BERRY CELESTE",
    "FRESH BLUEBERRY",
    "OZBLU",
    "SUN BELLE",
  ],

  etiquetasClamshell: [
    "SE",
    "BERRY BOOM",
    "BERRY TASTY",
    "BERRY PRINCESS",
    "BERRY VALLEY",
    "BLUE BERRY",
    "DRISCOLL´S",
    "DRISCOLL´S SWEETEST BATCH",
    "DELIGHT BERRY",
    "OZBLU",
    "EATME",
    "SUNBELLE",
  ],

  variedades: [
    "EB9-2",
    "ROSITA",
    "BIANCA BLUE",
    "IBUGA 002(ABRIL BLUE)",
    "MEGACRISP",
    "MEGAGRAND",
    "MEGAEARLY",
    "MEGAONE",
    "MEGACROP",
    "EUREKA SUNRISE ",
    "SOFIA ",
    "LEASA",
    "BREEZE",
    "OLIVIA",
    "VIOLETA",
    "CAROLINA",
    "CAROLINA ",
    "DINA",
    "AMY",
    "IBUGA 001 (ALESSIA BLUE)",
    "APEX (FCM14-057)",
    "CASCADE",
    "FCM17 - 132",
    "NS 16-07",
  ],

  productores: ["CAO", "BERRY HARVEST"],

  /** N° de línea de empaque (columna "N° LÍNEA"): 1 a 17. */
  lineas: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],

  /** Intervalo de cosecha en días (columna "INTERVALO DE COSECHA"): 5 a 13. */
  intervalosCosecha: [5, 6, 7, 8, 9, 10, 11, 12, 13],

  /** DNI + nombre completo de cada inspector de calidad registrado. */
  inspectores: [
    { dni: "70215616", nombre: "ROQUE ZAVALA PAULINO ROBERT" },
    { dni: "72368175", nombre: "BARANDIARAN ESTEVES VICTORIA" },
    { dni: "43102924", nombre: "CAHUAZA MENESES HORISON" },
    { dni: "75459229", nombre: "INOÑAN CAJUSOL DANITZA ONELIA" },
    { dni: "61123652", nombre: "PADILLA MANCHAY ELICIA" },
    { dni: "74547547", nombre: "ACARO CALLE MARIA JENY" },
    { dni: "75790001", nombre: "SANTISTEBAN ALAMO JAIR MICHAEL" },
    { dni: "40655735", nombre: "SUCLUPE SANDOVAL MARCIAL" },
    { dni: "60447916", nombre: "TAPIA RUBIO JAHAIRA GUISCEL" },
    { dni: "78114711", nombre: "TINEO ZEÑA ANGGY ZADITH" },
    { dni: "75528187", nombre: "BARRIOS FLORES FLOR" },
  ],

  /**
   * Nombres de empacadores registrados. La hoja "Lista Maestra" no trae el
   * DNI de ningún empacador (columna "DNI EMPACADOR" vacía en el Excel) —
   * por eso acá van solo los nombres, sin el cruce automático por DNI que sí
   * existe para inspectores. Si el cliente completa esos DNIs más adelante,
   * alcanza con sumarlos acá.
   */
  empacadores: [
    "ACOSTA CALLACNA MANUEL ",
    "ACOSTA SANCHEZ JOSE ",
    "BANCES SANTIESTEBAN MELISSA ",
    "CHAPOÑAN ZAPATA JESUS ",
    "CHAPOÑAN ZAPATA MARIELA ",
    "FARROÑAN SANDOVAL MANUEL",
    "LLONTOP PINGO LUCINDA",
    "LLONTOP PINGO VIOLETA",
    "LLONTOP SANTAMARÍA ESPERANZA",
    "LLONTOP SANTAMARÍA JULIA",
    "MACALOPU SERREPE KASANDRA ",
    "MACALOPU SERREPE ROMARIO",
    "MAZA IZQUIERDO RUTH",
    "MONTALVÁN GÓMEZ ANDY ",
    "MORI BANCES CECILIO",
    "NIMA TORRES JOSE",
    "OLIVA NIMA TOMAS",
    "PECHE SANTIESTEBAN GEAN MARCO",
    "PECHE SANTIESTEBAN ROGGER ",
    "SANDOVAL BANCES ALEXIS ",
    "SANDOVAL FARROÑAN DIANA",
    "SANDOVAL FARROÑAN HERBER ",
    "SANTAMARÍA BALDERA MARTINA",
    "SANTAMARÍA SOPLAPUCO JUANA",
    "SANTIESTEBAN LLONTOP DILBER ",
    "SIESQUEN SANDOVAL ELIZABETH ",
    "SOPLAPUCO LLONTOP MIGUEL ",
    "SOPLAPUCO MOZO JUAN FRANCISCO ",
    "SOPLOPUCO SANTAMARÍA MARTIN",
    "SUCLUPE SANDOVAL CESAR ",
    "TANTALEAN ACOSTA DAVID",
    "TINEO CUEVA LUZ",
    "TIQUILLAHUANCA SÁNCHEZ SAMUEL",
    "VALDERA SANTIESTEBAN FRANK",
    "ZAPATA LLONTOP ANDERSON ",
    "ZEÑA  SANTIESTEBAN JOSÉ ",
  ],
} as const;
