// Nodos OPC UA del historian que el gemelo usa por su nombre.
// Si el colector cambia algún nombre, solo se cambia aquí.
//
// plc es la estación como la entrega el panel (backend_panel_retoOtIt/src/configuracion/historian.ts):
//   S7-300  = estación Amatrol (la garra)
//   S7-1500 = tablero neumático S7-1516 (los pistones)
//   S7-1200 = luces de la torreta y eventos

export type NodoConocido = { plc: string; nodo: string }

export const PLC_TABLERO = 'S7-1500'

// Nodos del S7-1516. Los Bool llegan como 1 / 0 (el panel convierte "True" / "False").
export const NODO = {
  // estado
  torreta: 'TAB_TORRETA', // ver TORRETA
  latido: 'LATIDO', // sube sin parar; si no cambia en SEGUNDOS_SIN_LATIDO, no hay comunicación
  paso: 'TAB_PASO', // 0 a 9, ver PASOS
  marcha: 'TAB_MARCHA',
  falla: 'TAB_FALLA',
  codFalla: 'TAB_COD_FALLA',
  // contadores y tiempos
  ciclos: 'TAB_CICLOS',
  aluminio: 'TAB_ALUMINIO',
  otras: 'TAB_OTRAS',
  tCiclo: 'TAB_T_CICLO_S',
  tCarreraPd1: 'TAB_T_CARRERA_PD1_S',
  // salidas
  empujaExt: 'TAB_EMPUJA_EXT', // PD-1 (el de en medio) se extiende
  empujaRet: 'TAB_EMPUJA_RET', // PD-1 se retrae
  aprieta: 'TAB_APRIETA', // PD-2 (el de abajo) cierra
  suelta: 'TAB_SUELTA', // PD-2 abre
  sello: 'TAB_SELLO', // PS (el de arriba), simple efecto: baja; en False regresa por resorte
  // sensores
  fincEmpujar: 'TAB_FINC_EMPUJAR',
  fincApretar: 'TAB_FINC_APRETAR',
  fincSinApretar: 'TAB_FINC_SIN_APRETAR',
  fincSello: 'TAB_FINC_SELLO',
  sensorC: 'TAB_SENSOR_C', // capacitivo: hay pieza
  sensorI: 'TAB_SENSOR_I', // inductivo: metal
  esAluminio: 'TAB_ES_ALUMINIO',
} as const

export type ClaveNodo = keyof typeof NODO

// Los que se repiten en el gemelo en vivo (todos).
export const NODOS_TABLERO: string[] = Object.values(NODO)

// Para quien pide un nodo con su estación.
const enTablero = (nodo: string): NodoConocido => ({ plc: PLC_TABLERO, nodo })
export const NODOS = {
  torreta: enTablero(NODO.torreta),
  latido: enTablero(NODO.latido),
  paso: enTablero(NODO.paso),
  piezasAluminio: enTablero(NODO.aluminio),
  piezasOtras: enTablero(NODO.otras),
  falla: enTablero(NODO.falla),
  codFalla: enTablero(NODO.codFalla),
  tCiclo: enTablero(NODO.tCiclo),
  tCarreraPd1: enTablero(NODO.tCarreraPd1),
} satisfies Record<string, NodoConocido>

// TAB_TORRETA, lo calcula el S7-1516:
//   1 verde fijo          marcha
//   2 amarillo fijo       mantenimiento (botón enclavado en el S7-1200; bloquea el arranque)
//   3 rojo fijo           paro o falla
//   4 amarillo parpadeando reset en curso (unos 3 s)
// Cualquier otro valor: todas apagadas, sin dato.
export const TORRETA = {
  marcha: 1,
  mantenimiento: 2,
  paro: 3,
  reset: 4,
} as const

// Pasado este tiempo sin que LATIDO cambie, se da por perdida la comunicación.
export const SEGUNDOS_SIN_LATIDO = 5

// TAB_PASO, la secuencia del S7-1516:
//   0 reposo · 1 arranque · 2 empuja · 3 regresa · 4 detecta · 5 aprieta
//   6 / 7 sello (uno por material) · 8 suelta · 9 fin
// Qué sello es de qué material salió de los conteos (el 7 aparece más, como el plástico).
export const PASOS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const
export const SELLO_POR_PASO = { 6: 'al', 7: 'pl' } as const

// Las estaciones en el orden en que se muestran.
export const ESTACIONES = ['S7-1200', 'S7-1500', 'S7-300'] as const
export type Estacion = (typeof ESTACIONES)[number]
