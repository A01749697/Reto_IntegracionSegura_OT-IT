// Reglas de lo que la API receptora acepta.
// Cada lectura es una fila del historian de la IDMZ, tal cual: el agente de IT solo la reenvía.
// Las tablas son las de docker_retoOtIt/db/historian.sql.

// estación -> tabla del historian. La tabla nunca sale de lo que manda el agente, sale de aquí.
export const TABLAS_POR_ESTACION = {
  '300': 'telemetria_300', // Amatrol con S7-300 (CPU 314C): la garra
  '1500': 'telemetria_1500', // tablero neumático en S7-1516: los pistones
  '1200': 'telemetria_1200', // torreta y eventos del S7-1200
} as const

export type Estacion = keyof typeof TABLAS_POR_ESTACION

export const ESTACIONES = Object.keys(TABLAS_POR_ESTACION) as Estacion[]

// Nombre del nodo OPC UA (por ejemplo TAB_PISTON_A o LATIDO).
export const FORMATO_NODO = /^[A-Za-z0-9_.-]{1,100}$/
// El valor llega como texto: True, False, 4, 0.0, -1.5e-3...
export const FORMATO_VALOR = /^[A-Za-z0-9_.+-]{1,64}$/

export const MAXIMO_LECTURAS_POR_ENVIO = 500
export const LIMITE_CUERPO = '100kb'
export const VENTANA_PASADO_MS = 7 * 24 * 60 * 60 * 1000
export const VENTANA_FUTURO_MS = 5 * 60 * 1000
