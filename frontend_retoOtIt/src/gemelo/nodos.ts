// Los nodos OPC UA del historian que el gemelo usa por su nombre.
// Si el colector cambia algún nombre, solo se cambia aquí.
// Todo lo demás que llegue de las tres estaciones se muestra tal cual en "Lecturas de la celda".
//
// plc es la estación como la entrega el panel (ver backend_panel_retoOtIt/src/configuracion/historian.ts):
//   S7-300  = estación Amatrol (la garra)
//   S7-1500 = tablero neumático (los pistones)
//   S7-1200 = la que prende las luces de la torreta y manda eventos

export type NodoConocido = { plc: string; nodo: string }

export const NODOS = {
  // estado de la torreta: un solo número que calcula el S7-1516 en el OB30 a partir de DB_Tablero.
  // Dice lo que la torreta DEBERÍA mostrar, no lo que prende el S7-1200 (%Q6.0..%Q6.2).
  torreta: { plc: 'S7-1500', nodo: 'TAB_TORRETA' },
  // TORRETA_REAL: las luces que de verdad prende el S7-1200 (%QB6), en la misma escala que
  // TAB_TORRETA; 0 = ninguna luz o más de una. Todavía no existe: llegará con el PUT de
  // eventos del S7-1200 al S7-1516. Mientras no llegue, el panel no compara nada.
  torretaReal: { plc: 'S7-1500', nodo: 'TORRETA_REAL' },
  // grupo Sistema: "DB_Telemetria".LATIDO, sube 1 cada dos ejecuciones del OB30.
  // No tiene ritmo fijo: se vigila que cambie, no cuánto.
  latido: { plc: 'S7-1500', nodo: 'LATIDO' },
  // contadores del S7-1516: suben 1 por cada pieza que identifica (TAB_ALUMINIO + TAB_OTRAS
  // = TAB_CICLOS). En vivo, cada vez que suben entra al gemelo una pieza de ese material.
  piezasAluminio: { plc: 'S7-1500', nodo: 'TAB_ALUMINIO' },
  piezasOtras: { plc: 'S7-1500', nodo: 'TAB_OTRAS' },
  // paso de la secuencia del S7-1516 (0 a 9); el gemelo lo repite (ver seguidor.ts)
  paso: { plc: 'S7-1500', nodo: 'TAB_PASO' },
} satisfies Record<string, NodoConocido>

export type ClaveNodo = keyof typeof NODOS

// Valores de TAB_TORRETA:
//   1 verde fijo          MARCHA y no FALLA
//   2 amarilla fija       mantenimiento (botón enclavado en el S7-1200; bloquea el arranque)
//   3 roja fija           parado o en falla
//   4 amarilla parpadeando reset en curso (unos 3 s)
// Solo el verde es marcha de los pistones. Cualquier otro valor: todas apagadas, sin dato.
export const ESTADOS_TORRETA = {
  verde: 1,
  amarilla: 2,
  roja: 3,
  reset: 4,
} as const

// TAB_PASO, la secuencia del S7-1516:
//   0 reposo · 1 arranque · 2 empuja · 3 regresa el empujador
//   4 detecta: el pistón de apriete sale y regresa y el capacitivo lo ve
//   5 aprieta · 6 / 7 sello (uno distinto por material) · 8 suelta · 9 fin de secuencia
// ⚠ Qué paso de sello es de qué material está deducido de los conteos (el 7 sale más,
// igual que el plástico); si es al revés, solo se cambia aquí.
export const SELLO_POR_PASO = { 6: 'al', 7: 'pl' } as const
export const PASOS_DEL_SELLO = { al: 6, pl: 7 } as const

// Las estaciones en el orden en que se muestran.
export const ESTACIONES = ['S7-1200', 'S7-1500', 'S7-300'] as const
export type Estacion = (typeof ESTACIONES)[number]
