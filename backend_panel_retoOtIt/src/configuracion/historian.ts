// Las estaciones del historian (ver docker_retoOtIt/db/historian.sql).
// plc que ve el panel -> tabla del historian. El nombre de la tabla nunca sale de la petición.
export const TABLAS_POR_PLC = {
  'S7-300': 'telemetria_300', // Amatrol con S7-300 (CPU 314C): la garra
  'S7-1500': 'telemetria_1500', // tablero neumático en S7-1516: los pistones
  'S7-1200': 'telemetria_1200', // torreta y eventos del S7-1200
} as const

export type PlcHistorian = keyof typeof TABLAS_POR_PLC

export const PLCS_HISTORIAN = Object.keys(TABLAS_POR_PLC) as PlcHistorian[]

export function esPlcHistorian(x: unknown): x is PlcHistorian {
  return typeof x === 'string' && Object.hasOwn(TABLAS_POR_PLC, x)
}

// Nombre de un nodo OPC UA, igual que lo acepta la API receptora (por ejemplo TAB_PISTON_A).
export const FORMATO_NODO = /^[A-Za-z0-9_.-]{1,100}$/
