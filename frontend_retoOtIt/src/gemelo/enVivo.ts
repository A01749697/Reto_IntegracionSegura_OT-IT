// Convierte las lecturas más recientes del historian en lo que usa el gemelo en vivo.
import type { UltimaLectura } from './apiLecturas'
import type { Valores } from './estado'
import { ESTACIONES, PLC_TABLERO, type Estacion } from './nodos'

export type NodoLeido = { nodo: string; valor: number; ts: string }

export type LecturasCelda = {
  // todos los nodos de cada estación, ordenados por nombre
  estaciones: Record<Estacion, NodoLeido[]>
  ultima: string | null // fecha de la lectura más reciente de cualquier estación
  tablero: Valores // último valor de cada nodo del S7-1516
  ultimaTablero: number | null // ts (ms) de la lectura más reciente del S7-1516
}

export type Enlace =
  'conectando' | 'en_vivo' | 'atrasado' | 'sin_lecturas' | 'sin_conexion'

// Pasado este tiempo sin lecturas nuevas se avisa que están atrasadas (igual que en Estado).
export const SEGUNDOS_ATRASO = 5 * 60

function vacias(): Record<Estacion, NodoLeido[]> {
  return { 'S7-1200': [], 'S7-1500': [], 'S7-300': [] }
}

const esEstacion = (plc: string): plc is Estacion =>
  (ESTACIONES as readonly string[]).includes(plc)

export function resumirLecturas(lecturas: UltimaLectura[]): LecturasCelda {
  const resumen: LecturasCelda = {
    estaciones: vacias(),
    ultima: null,
    tablero: {},
    ultimaTablero: null,
  }
  for (const { plc, variable, valor, ts } of lecturas) {
    const fecha = Date.parse(ts)
    if (!esEstacion(plc) || Number.isNaN(fecha)) continue
    resumen.estaciones[plc].push({ nodo: variable, valor, ts })
    if (plc === PLC_TABLERO) {
      resumen.tablero[variable] = valor
      if (resumen.ultimaTablero === null || fecha > resumen.ultimaTablero)
        resumen.ultimaTablero = fecha
    }
    if (resumen.ultima === null || fecha > Date.parse(resumen.ultima))
      resumen.ultima = ts
  }
  for (const estacion of ESTACIONES)
    resumen.estaciones[estacion].sort((a, b) => a.nodo.localeCompare(b.nodo))
  return resumen
}

// Cómo quedó el enlace después de una consulta que sí respondió.
export function estadoEnlace(lecturas: LecturasCelda, ahora: number): Enlace {
  if (lecturas.ultima === null) return 'sin_lecturas'
  return ahora - Date.parse(lecturas.ultima) > SEGUNDOS_ATRASO * 1000
    ? 'atrasado'
    : 'en_vivo'
}
