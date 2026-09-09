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
  // Los primeros 4 vienen de la hoja "Lista Maestra" del Excel de referencia;
  // el resto los agregó el usuario directamente (07/09/2026), no están en
  // ese archivo. "OZBLU" y "ENGSHENG" (que el usuario había tipeado) eran el
  // mismo cliente que "OZBLUE" y "PENGSHENG" — confirmado por el usuario,
  // se sacaron para no dejar dos entradas duplicadas en la lista.
  clientes: [
    "PENGSHENG",
    "OZBLUE",
    "DRISCOLL´S",
    "BERRIES PRIDE BV",
    "GLOBAL BERRY S.L.",
    "THUNG SHING",
    "PAGODA",
    "RIVERKING",
    "XIANFENG",
  ],

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

  /**
   * Etiquetas de "Planta de Empaque" (antes era un número libre). Lista
   * base a pedido del cliente — a diferencia de "lineas"/"intervalosCosecha"
   * (números fijos de la hoja del Excel), esta SÍ se siembra como catálogo
   * editable (tipo "planta_empaque" en seedListaMaestra) para poder sumar
   * plantas nuevas sin tocar código, igual que Cliente/Destino/etc.
   */
  plantasEmpaque: ["Acopio 1", "Acopio 2", "MAERSK"],

  /** N° de línea de empaque (columna "N° LÍNEA"): 1 a 17. */
  lineas: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],

  /** Intervalo de cosecha en días (columna "INTERVALO DE COSECHA"): 5 a 13. */
  intervalosCosecha: [5, 6, 7, 8, 9, 10, 11, 12, 13],

  /**
   * DNI + nombre completo de cada inspector de calidad registrado.
   * Fuente: hoja "INSPECTORES DE CALIDAD" del Excel
   * docs/referencia-cliente/Lista maestra de empacadores-Inspectores de
   * Calidad.xlsx (actualizado 08/09/2026, reemplaza la lista anterior que
   * venía de la hoja "Lista Maestra" del Excel de defectos). Cambios reales
   * de personal detectados frente a la lista previa: se dio de baja
   * "SANTISTEBAN ALAMO JAIR MICHAEL" (DNI 75790001, ya no aparece en la hoja
   * fuente) y se agregó "VALLEJOS PAIVA ELIZABETH" (DNI 76740678).
   */
  inspectores: [
    { dni: "70215616", nombre: "ROQUE ZAVALA PAULINO ROBERT" },
    { dni: "72368175", nombre: "BARANDIARAN ESTEVES VICTORIA" },
    { dni: "43102924", nombre: "CAHUAZA MENESES HORISON" },
    { dni: "75459229", nombre: "INOÑAN CAJUSOL DANITZA ONELIA" },
    { dni: "61123652", nombre: "PADILLA MANCHAY ELICIA" },
    { dni: "74547547", nombre: "ACARO CALLE MARIA JENY" },
    { dni: "40655735", nombre: "SUCLUPE SANDOVAL MARCIAL" },
    { dni: "60447916", nombre: "TAPIA RUBIO JAHAIRA GUISCEL" },
    { dni: "78114711", nombre: "TINEO ZEÑA ANGGY ZADITH" },
    { dni: "75528187", nombre: "BARRIOS FLORES FLOR" },
    { dni: "76740678", nombre: "VALLEJOS PAIVA ELIZABETH" },
  ],

  /**
   * DNI + nombre completo de cada empacador registrado.
   * Fuente: hoja "EMPACADORES" del Excel docs/referencia-cliente/Lista
   * maestra de empacadores-Inspectores de Calidad.xlsx (actualizado
   * 08/09/2026, 203 registros únicos por DNI — la hoja traía una fila
   * duplicada para el DNI 75772217, se dejó una sola vez). Reemplaza la
   * lista anterior de solo nombres (sin DNI) que venía de la hoja "Lista
   * Maestra" del Excel de defectos; ahora, igual que con los inspectores, el
   * autocompletado nombre→DNI y DNI→nombre funciona también acá.
   *
   * Nota: el DNI 76740678 ("PAIVA VALLEJOS ELIZABETH ABIGAIL" acá,
   * "VALLEJOS PAIVA ELIZABETH" en inspectores) aparece en ambas hojas del
   * Excel fuente — la misma persona figura registrada como empacadora e
   * inspectora. Se dejó tal cual está en el archivo del cliente, sin
   * fusionar ni quitar de ninguna de las dos listas.
   */
  empacadores: [
    { dni: "76846537", nombre: "ACOSTA CALLACNA MANUEL WILLIAM" },
    { dni: "46738513", nombre: "ACOSTA SANCHEZ JOSE" },
    { dni: "76763698", nombre: "ACOSTA VENTURA MARIA NANCY" },
    { dni: "80403405", nombre: "AGUILAR PUPUCHE ANA PATRICIA" },
    { dni: "48399847", nombre: "ALARCON ARICOCHE JANET DEL ROCIO" },
    { dni: "75772217", nombre: "ALDANA SIANCAS ANDY ALBERTO" },
    { dni: "48475305", nombre: "ANGELES OLIVA YANINA DEL MILAGRO" },
    { dni: "45754167", nombre: "BALLONA LASERNA MAYRA GUISSELA" },
    { dni: "72723112", nombre: "BALLONA LEON YOMIRA NOEMI" },
    { dni: "75179951", nombre: "BALLONA RODAS MAYRA JANET" },
    { dni: "75612130", nombre: "BANCES SANTISTEBAN MELISSA DEL ROCIO" },
    { dni: "61526307", nombre: "BARRIOS RODRIGUEZ DIEGO ALBERTO" },
    { dni: "75493818", nombre: "BAZAN CASIANO JESUS JIMMY" },
    { dni: "75555096", nombre: "BAZAN CHAVESTA JOSE AUGUSTO" },
    { dni: "75533372", nombre: "BENITES SIESQUEN JHON RAFAEL" },
    { dni: "78234975", nombre: "BERMEJO SILUPU JAIRO ANDERSON" },
    { dni: "75732414", nombre: "BERNA ALVAREZ OLMER LEODAN" },
    { dni: "40963355", nombre: "BERNILLA SANTIAGO RITA SANTOS" },
    { dni: "73582070", nombre: "BERNILLA SUCLUPE NOLBERTO CARLOS" },
    { dni: "75313300", nombre: "BRAVO AGUINAGA YERSON ESMITH" },
    { dni: "60912477", nombre: "CABRERA DAMIAN KEYLA SARAIN" },
    { dni: "75909534", nombre: "CAJUSOL GARCIA JESUS ANTONIO" },
    { dni: "60448012", nombre: "CAJUSOL SUCLUPE BLANCA LILIANA" },
    { dni: "48477787", nombre: "CALLE CHAVEZ SENEIDA DUVID" },
    { dni: "75824913", nombre: "CARBONEL ROJAS JORGE LUIS" },
    { dni: "47772581", nombre: "CASAS BARRERA YESICA CRISANTA" },
    { dni: "48711562", nombre: "CASTAÑEDA POTENCIANO WHITNEY ARLET" },
    { dni: "80518340", nombre: "CASTRO AGUIRRE ROSA ELENA" },
    { dni: "47387209", nombre: "CASTRO NAVARRO DIANA CAROLINA" },
    { dni: "75902198", nombre: "CAVERO CAVERO LUZ ESTEFANY" },
    { dni: "61124279", nombre: "CAVERO DURAND XAMIRA BELEN" },
    { dni: "76265839", nombre: "CAVERO SUCLUPE RAQUEL NOEMI" },
    { dni: "41896083", nombre: "CESPEDES CARLOS VERONICA" },
    { dni: "75497035", nombre: "CESPEDES CHINCHAY CECILIA GABRIELA" },
    { dni: "45377368", nombre: "CESPEDES MONTALVO LAIVE SUJEY" },
    { dni: "76687374", nombre: "CÉSPEDES PURIHUAMAN DORCAS JANELLA" },
    { dni: "76093517", nombre: "CHANAME FERNANDEZ LOIDA RAQUEL" },
    { dni: "46832707", nombre: "CHAPOÑAN ZAPATA JESUS ALBERTO" },
    { dni: "46736188", nombre: "CHAPOÑAN ZAPATA MARIELA" },
    { dni: "76293883", nombre: "CHAPOÑAN ZAPATA VIRGINIA" },
    { dni: "48798257", nombre: "CHAQUILA BOCANEGRA LETICIA" },
    { dni: "76039344", nombre: "CHUMACERO PINTADO JEAN PIER" },
    { dni: "74578992", nombre: "CHUMBES HUAMANI ADRIAN" },
    { dni: "77054183", nombre: "CHUZON HEREDIA JENNIFER THAIS" },
    { dni: "60937364", nombre: "CHUZON HERNANDEZ KAREN DAYANA" },
    { dni: "46164002", nombre: "COBEÑA ROQUE YAQUELINE MARILU" },
    { dni: "73438015", nombre: "COBEÑAS MACO VANESSA" },
    { dni: "43610599", nombre: "CONTRERAS CABANILLAS WAGNER YHOMERIK AGUSTIN" },
    { dni: "17445689", nombre: "CORNEJO MERINO VDA DE REUPO JULIA ISMELDA" },
    { dni: "75899208", nombre: "CORONADO YPANAQUE ANGHELA VANESA" },
    { dni: "47621494", nombre: "DAMIAN CHINCHAY CHISTIAN ABEL" },
    { dni: "62951045", nombre: "DAMIÁN CHINCHAY CKREYLA ALEJANDRA" },
    { dni: "75235753", nombre: "DAMIAN VALDERA BRAYAN RONALDO" },
    { dni: "60161954", nombre: "DAMIAN VALDERA NATALY DEL MILAGRO" },
    { dni: "43103856", nombre: "DIAZ JULCA MARIA LIDIA" },
    { dni: "17434151", nombre: "DIAZ ROJAS LUCILA YSABEL" },
    { dni: "41831291", nombre: "DIOSES QUIROGA WINSTON DAVID" },
    { dni: "70060793", nombre: "DOMINGUEZ HOLGUIN MARIA LUISA" },
    { dni: "80520712", nombre: "ENEQUE CRUZ MARLENY MAGDALENA" },
    { dni: "48242119", nombre: "ESCOBAR PACHECO LUCY ANDREA" },
    { dni: "76394611", nombre: "FARROÑAN SANDOVAL WILLIAN JOEL" },
    { dni: "77389761", nombre: "FARROÑAN SANDOVAL YORDY MANUEL" },
    { dni: "17431100", nombre: "FERRE BURGA ANA MELVA" },
    { dni: "44518214", nombre: "FERRE SOLANO ROSA AMELIA" },
    { dni: "73487842", nombre: "FLORES LIZANA AHIRELY" },
    { dni: "44519615", nombre: "FLORES PÉREZ CARLOS ALONSO" },
    { dni: "73235386", nombre: "FLORES RAMIREZ ALDANA BELEN" },
    { dni: "60807015", nombre: "GALVEZ ALBERCA WILIAN JOEL" },
    { dni: "44215199", nombre: "GARCIA CAJUSOL MARIA SANTOS" },
    { dni: "75964548", nombre: "GARCIA FLORES ANTONIO CARLOS" },
    { dni: "73583949", nombre: "GUERRERO SOSA JORDAN ALDAHIR" },
    { dni: "46276644", nombre: "GUEVARA VASQUEZ DEISY" },
    { dni: "43477582", nombre: "GUEVARA VASQUEZ MILYN YOVANIT" },
    { dni: "75369404", nombre: "HEREDIA NEYRA YONNAR JOSEPH" },
    { dni: "61242695", nombre: "HERNANDEZ SANDOVAL KEILA MEDALI" },
    { dni: "62729214", nombre: "HUIMAN SIADEN LIZETH DEL ROCIO" },
    { dni: "43007543", nombre: "INGA HERNANDEZ ROSARIO DEL MILAGRO" },
    { dni: "60973020", nombre: "JARAMILLO PARRAGUEZ ARMANDO JOSE" },
    { dni: "75502448", nombre: "JIBAJA HUANCAS KAREN" },
    { dni: "45493410", nombre: "JUAREZ FERNANDEZ JUAN CARLOS" },
    { dni: "75145219", nombre: "JUAREZ INOÑAN MERLY JOHANA" },
    { dni: "76017922", nombre: "JURUPE CAVERO CESAR ALEXANDER" },
    { dni: "17429955", nombre: "LLAGUENTO FARRO AGUSTÍN" },
    { dni: "48400603", nombre: "LLAGUENTO YESQUEN ESTEFANIA DEL ROSARIO" },
    { dni: "48454420", nombre: "LLONTOP PINGO DE MORI VIOLETA" },
    { dni: "47894342", nombre: "LLONTOP PINGO LUCINDA" },
    { dni: "43058485", nombre: "LLONTOP SANTAMARIA JULIA" },
    { dni: "46746456", nombre: "LLONTOP SUCLUPE ADELINA ESTHER" },
    { dni: "75867522", nombre: "LOPEZ CASTRO LUIS GUSTAVO" },
    { dni: "73528581", nombre: "LOPEZ FERNANDEZ KATHERIN RAQUEL" },
    { dni: "78112176", nombre: "LOPEZ PECHE MARIA ELENA" },
    { dni: "76543174", nombre: "LUCERO CHUCAS LUIS FELIPE" },
    { dni: "76005946", nombre: "MACALOPU SERREPE KASANDRA LISET" },
    { dni: "75996688", nombre: "MACALOPU SERREPE ROMARIO ALEXANDER" },
    { dni: "76576084", nombre: "MACALOPU ZEÑA LUIS ADRIAN" },
    { dni: "45671416", nombre: "MANAYAY CESPEDES FABIOLA" },
    { dni: "73306199", nombre: "MARTINEZ BARRETO SUSY ESTEFANY" },
    { dni: "73122062", nombre: "MARTINEZ PEREZ VILMA THALIA" },
    { dni: "46935065", nombre: "MAYANGA MACO SARA" },
    { dni: "60884236", nombre: "MAZA IZQUIERDO LEONARDO ALEJANDRO" },
    { dni: "48845813", nombre: "MAZA IZQUIERDO RUTH GERALDINE" },
    { dni: "74168764", nombre: "MENDOZA HERRERA CARLA ALEXIA" },
    { dni: "46048625", nombre: "MENDOZA PALACIOS YRAIDA CONSUELO" },
    { dni: "72388332", nombre: "MILLONES PRADA YESSICA ANGELICA" },
    { dni: "71593332", nombre: "MONTALVAN DE LA CRUZ JOSELYN YADHIRA" },
    { dni: "76055706", nombre: "MONTALVAN GOMEZ ANDY OSMAR" },
    { dni: "46707340", nombre: "MORI BANCES CECILIO" },
    { dni: "75541519", nombre: "NEYRA AYALA JOSE MIGUEL" },
    { dni: "76246490", nombre: "NIMA TORRES JOSE MARIA" },
    { dni: "74567942", nombre: "OLIVA GINES ESTEFANY JHERALDINE" },
    { dni: "43744117", nombre: "OLIVA NIMA TOMAS ARMANDO" },
    { dni: "76740678", nombre: "PAIVA VALLEJOS ELIZABETH ABIGAIL" },
    { dni: "80684033", nombre: "PANTA CHERRES LUIS ALBERTO" },
    { dni: "75993117", nombre: "PANTA DE LA TORRE FREDDY BERNARDO" },
    { dni: "44778827", nombre: "PAZ PAZ JUAN JAVIER" },
    { dni: "60160245", nombre: "PAZ RAMON YUDID" },
    { dni: "75783307", nombre: "PECHE SANTISTEBAN GEAN MARCO" },
    { dni: "75783306", nombre: "PECHE SANTISTEBAN JUAN SEBASTIAN" },
    { dni: "75783305", nombre: "PECHE SANTISTEBAN ROGGER" },
    { dni: "73583946", nombre: "PERALTA TANTARICO DAVID" },
    { dni: "77336429", nombre: "PEREZ MARTINEZ GILBER" },
    { dni: "71531693", nombre: "PÉREZ RAMOS MARÍA ALEJANDRA" },
    { dni: "74375987", nombre: "PINTADO CALDERON MARIN VALERIA" },
    { dni: "76646127", nombre: "PISCOYA JURUPE JESUS MIGUEL" },
    { dni: "76853474", nombre: "PISCOYA JURUPE MARIA GUADALUPE" },
    { dni: "78632391", nombre: "PISCOYA PRIMO MARCOS JOSE" },
    { dni: "60894983", nombre: "PISFIL VALDERRAMA LUIS ANGEL" },
    { dni: "74449994", nombre: "PRECIADO BALLADARES ARIANA MILAGRITOS" },
    { dni: "46365713", nombre: "PRIMO DIAZ JOSE ALEXANDER" },
    { dni: "60853147", nombre: "PUSE CHERO YEREMIC ZAIR" },
    { dni: "74376289", nombre: "PUSMA AGUIRRE YELI" },
    { dni: "60195623", nombre: "QUISPE CALLE ARLI ANALI" },
    { dni: "74576679", nombre: "RACCHUMI MACALOPU MARIA DE FATIMA" },
    { dni: "76304743", nombre: "RAMIREZ COBENAS ANAI NAYELLI" },
    { dni: "72532675", nombre: "RAMON CHAQUILA FLOR GISELA" },
    { dni: "75908373", nombre: "RAMOS IZAGA CESAR AUGUSTO" },
    { dni: "61719538", nombre: "RAMOS PURIZACA SARITA ITAMAR" },
    { dni: "09479975", nombre: "REYES GUZMAN ELIZABETH" },
    { dni: "43682350", nombre: "REYES VASQUEZ GLORIA ESTHER" },
    { dni: "61070929", nombre: "RINZA VALLADOLID LENIN XAVIER" },
    { dni: "76048300", nombre: "RIOS CHAVEZ DILMER JOEL" },
    { dni: "76048299", nombre: "RIOS CHAVEZ MARIA DIANA" },
    { dni: "03365833", nombre: "RIOS MURILLO JOSE MANUEL" },
    { dni: "72532779", nombre: "RODRIGUEZ BARRIOS JORGE" },
    { dni: "46484086", nombre: "ROJAS SOSA MILAGROS MEDALLY" },
    { dni: "75577934", nombre: "ROQUE BARRERA ROSA ELIZABETH" },
    { dni: "45177893", nombre: "ROQUE LOPEZ DONICIA" },
    { dni: "73581857", nombre: "SAAVEDRA MECHAN ELMER ADRIAN" },
    { dni: "40987235", nombre: "SACA VELASQUEZ KARINA EMPERATRIZ" },
    { dni: "80309259", nombre: "SANCHEZ CESPEDES JESUS MARIBEL" },
    { dni: "75739940", nombre: "SANCHEZ MANAYAY JOSE LUIS" },
    { dni: "75838064", nombre: "SANDOVAL BANCES ALEXIS ROBINSON" },
    { dni: "76878943", nombre: "SANDOVAL FARROÑAN DIANA MARIBEL" },
    { dni: "76878942", nombre: "SANDOVAL FARROÑAN HEBER ALEXANDER" },
    { dni: "43686127", nombre: "SANDOVAL QUESQUEN JENNY ELIZABETH" },
    { dni: "47953240", nombre: "SANDOVAL QUESQUEN JULIANNA DEL MILAGRO" },
    { dni: "76699392", nombre: "SANTAMARIA SOPLAPUCO JUANA FILOMENA" },
    { dni: "75860115", nombre: "SANTAMARIA TAPIA LUZ ANGELICA" },
    { dni: "61219863", nombre: "SANTISTEBAN LLONTOP DILVER CELSO" },
    { dni: "46738516", nombre: "SANTISTEBAN SANTISTEBAN DEYSI PAMELA" },
    { dni: "47469303", nombre: "SANTISTEBAN SANTISTEBAN NATALIA DEL PILAR" },
    { dni: "61123530", nombre: "SANTOS CHAPA MARIA FIORELA" },
    { dni: "61427470", nombre: "SANTOS TORRES DARWIN" },
    { dni: "72532464", nombre: "SANTOS TORRES LISBET SOFIA" },
    { dni: "72532463", nombre: "SANTOS TORRES MIRIAN GISELA" },
    { dni: "75866540", nombre: "SIESQUEN ESPINOZA ELMER JOSE" },
    { dni: "76947173", nombre: "SIESQUEN SANDOVAL ELIZABETH" },
    { dni: "76364906", nombre: "SOLORZANO BAZAN JEREMY AMIR" },
    { dni: "17447046", nombre: "SOPLAPUCO MOZO JUAN FRANCISCO" },
    { dni: "75746637", nombre: "SOPLAPUCO SANTAMARIA MARTIN" },
    { dni: "61124261", nombre: "SUCLUPE CASAS JOSÉ DAVID" },
    { dni: "48279189", nombre: "SUCLUPE LLAQUE MARIANELA BEATRIZ" },
    { dni: "75748318", nombre: "SUCLUPE LLONTOP EDWIN ALFREDO" },
    { dni: "76002541", nombre: "SUYON DE LA CRUZ JESUS PABLO" },
    { dni: "61070995", nombre: "SUYON INTOR BRYTNY DARLENY" },
    { dni: "17431987", nombre: "SUYON RUIZ MIRTHA ISABEL" },
    { dni: "75533114", nombre: "TANTA REYES DANNY JUAN JOSE" },
    { dni: "44327616", nombre: "TANTALEAN ACOSTA JOSE RAFAEL" },
    { dni: "61203368", nombre: "TINEO VASQUEZ KARLITA ALEXANDRA" },
    { dni: "61203369", nombre: "TINEO VASQUEZ NICOL JASMIN" },
    { dni: "73464113", nombre: "TIQUILLAHUANCA FLORES DIEGO ARMANDO" },
    { dni: "73488627", nombre: "TIQUILLAHUANCA SANCHEZ MILAGROS LISBETH" },
    { dni: "73488628", nombre: "TIQUILLAHUANCA SANCHEZ SAMUEL ALEXANDER" },
    { dni: "73866117", nombre: "TOCTO CARRION ROSMER" },
    { dni: "80640582", nombre: "TOVAR LA SERNA ANA CECILIA" },
    { dni: "74244731", nombre: "VALDERA SANTISTEBAN FRANK YONATAN" },
    { dni: "46696436", nombre: "VALLADOLID SIALER GISELA NATALI" },
    { dni: "75871133", nombre: "VALLEJOS PARDO GEINER" },
    { dni: "75954990", nombre: "VALLEJOS SAAVEDRA ANDERSON PIERO" },
    { dni: "75235154", nombre: "VASQUEZ QUINTANA JOSE ANTONY" },
    { dni: "60972959", nombre: "VERASTEGUI RAMOS JORGE JAIME" },
    { dni: "44468810", nombre: "VIDAURRE SANTAMARIA WALTER CELSO" },
    { dni: "76256836", nombre: "VIDAURRE SUYON ANTONIO ALBERTO" },
    { dni: "75761043", nombre: "VILCHEZ RAMOS LUZ MARINA" },
    { dni: "41518296", nombre: "YAJAHUANCA CUEVA ELVIA" },
    { dni: "62272088", nombre: "YAMUNAQUE JIMENEZ DIANA LIZET" },
    { dni: "76162389", nombre: "YAMUNAQUE JIMENEZ EVELIN MARLENY" },
    { dni: "75799373", nombre: "YESQUEN RAMOS YALU LUCIA ESTEFANI" },
    { dni: "60973044", nombre: "YESQUEN SANTISTEBAN JUAN JOSE" },
    { dni: "76069421", nombre: "YNOÑAN MIO KAREN FIORELLA" },
    { dni: "75592662", nombre: "ZAPATA LLONTOP ANDERSON ROLANDO" },
    { dni: "75097068", nombre: "ZEÑA SANTISTEBAN JOSE WALTER" },
    { dni: "75820413", nombre: "ZUÑIGA VALLEJOS KAREN MERCEDES" },
  ],
} as const;
