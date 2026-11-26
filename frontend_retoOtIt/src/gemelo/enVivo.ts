// Convierte las lecturas que llegan del historian en lo que el gemelo necesita.
// Los nombres de los nodos que se usan por su nombre están en nodos.ts.
import type { UltimaLectura } from './apiLecturas'
import type { Tipo } from './planta'
import {
  ESTACIONES,
  ESTADOS_TORRETA,
  NODOS,
  type ClaveNodo,
  type Estacion,
} from './nodos'

export type NodoLeido = { nodo: string; valor: number; ts: string }

export type LecturasCelda = {
  torreta: number | null // estado de la torreta (ver ESTADOS_TORRETA)
  torretaReal: number | null // lo que prende de verdad el S7-1200
  piezasAluminio: number | null // contador TAB_ALUMINIO
  piezasOtras: number | null // contador TAB_OTRAS
  latido: number | null
  // todos los nodos de cada estacion, ordenados por nombre
  estaciones: Record<Estacion, NodoLeido[]>
  ultima: string | null // fecha de la lectura mas reciente
}

export type Enlace =
  'conectando' | 'en_vivo' | 'atrasado' | 'sin_lecturas' | 'sin_conexion'

// Pasado este tiempo sin lecturas nuevas se avisa que estan atrasadas (igual que en Estado).
export const SEGUNDOS_ATRASO = 5 * 60

function vacias(): Record<Estacion, NodoLeido[]> {
  return { 'S7-1200': [], 'S7-1500': [], 'S7-300': [] }
}

export const SIN_LECTURAS: LecturasCelda = {
  torreta: null,
  torretaReal: null,
  piezasAluminio: null,
  piezasOtras: null,
  latido: null,
  estaciones: vacias(),
  ultima: null,
}

const esEstacion = (plc: string): plc is Estacion =>
  (ESTACIONES as readonly string[]).includes(plc)

const CLAVES = Object.keys(NODOS) as ClaveNodo[]

export function resumirLecturas(lecturas: UltimaLectura[]): LecturasCelda {
  const resumen: LecturasCelda = { ...SIN_LECTURAS, estaciones: vacias() }
  for (const { plc, variable, valor, ts } of lecturas) {
    const fecha = Date.parse(ts)
    if (!esEstacion(plc) || Number.isNaN(fecha)) continue
    resumen.estaciones[plc].push({ nodo: variable, valor, ts })
    for (const clave of CLAVES) {
      if (NODOS[clave].plc === plc && NODOS[clave].nodo === variable)
        resumen[clave] = valor
    }
    if (resumen.ultima === null || fecha > Date.parse(resumen.ultima))
      resumen.ultima = ts
  }
  for (const estacion of ESTACIONES)
    resumen.estaciones[estacion].sort((a, b) => a.nodo.localeCompare(b.nodo))
  return resumen
}

export type ColorTorreta = keyof typeof ESTADOS_TORRETA | 'otro'

// Qué color dice un valor en la escala de la torreta; null si no hay dato.
export function colorTorreta(valor: number | null): ColorTorreta | null {
  if (valor === null) return null
  const color = (
    Object.keys(ESTADOS_TORRETA) as (keyof typeof ESTADOS_TORRETA)[]
  ).find((c) => ESTADOS_TORRETA[c] === valor)
  return color ?? 'otro'
}

// La torreta manda: solo el estado verde es marcha. Sin dato, la celda queda en paro.
export function marchaPorTorreta(lecturas: LecturasCelda): boolean {
  return colorTorreta(lecturas.torreta) === 'verde'
}

// Compara lo que dice el tablero (TAB_TORRETA) con lo que prende el S7-1200 (TORRETA_REAL).
//   null: todavía no llega TORRETA_REAL, no hay nada que comparar
//   'luces': ninguna luz o varias a la vez (0 u otro valor fuera de la escala)
//   'distinta': cada uno dice un color diferente
export type ComparacionTorreta = 'coincide' | 'luces' | 'distinta'

export function compararTorreta(
  lecturas: LecturasCelda,
): ComparacionTorreta | null {
  const real = colorTorreta(lecturas.torretaReal)
  if (real === null) return null
  if (real === 'otro') return 'luces'
  return lecturas.torretaReal === lecturas.torreta ? 'coincide' : 'distinta'
}

// El latido no tiene ritmo exacto: la alarma es "no cambió en tanto tiempo".
export const SEGUNDOS_LATIDO = 15

// Último valor del latido y desde cuándo (reloj del navegador) no cambia.
export type VigiaLatido = { valor: number; desde: number }

export function vigilarLatido(
  vigia: VigiaLatido | null,
  valor: number | null,
  ahora: number,
): VigiaLatido | null {
  if (valor === null) return null
  if (vigia === null || vigia.valor !== valor) return { valor, desde: ahora }
  return vigia
}

// Segundos que lleva quieto, solo si ya pasó el límite; si no, null.
export function latidoDetenido(
  vigia: VigiaLatido | null,
  ahora: number,
): number | null {
  if (vigia === null) return null
  const segundos = Math.floor((ahora - vigia.desde) / 1000)
  return segundos >= SEGUNDOS_LATIDO ? segundos : null
}

// Como quedo el enlace despues de una consulta que si respondio.
export function estadoEnlace(lecturas: LecturasCelda, ahora: number): Enlace {
  if (lecturas.ultima === null) return 'sin_lecturas'
  return ahora - Date.parse(lecturas.ultima) > SEGUNDOS_ATRASO * 1000
    ? 'atrasado'
    : 'en_vivo'
}

// Contadores de piezas del S7-1516 la última vez que se consultaron.
export type Contadores = { al: number; pl: number }

// Si pasó mucho tiempo entre consultas (pestaña dormida, red caída) no se meten todas:
// solo las últimas, para que el gemelo no se quede minutos ponéndose al día.
export const MAXIMO_POR_CONSULTA = 6

// Cuántas piezas entraron desde la consulta anterior, y de qué material.
// La primera consulta solo toma la referencia; si un contador baja, se reinició y se
// toma como nueva referencia sin inventar piezas.
export function piezasNuevas(
  anterior: Contadores | null,
  lecturas: LecturasCelda,
): { contadores: Contadores | null; nuevas: Tipo[] } {
  const { piezasAluminio, piezasOtras } = lecturas
  if (piezasAluminio === null && piezasOtras === null)
    return { contadores: anterior, nuevas: [] }
  const actuales = {
    al: Math.round(piezasAluminio ?? 0),
    pl: Math.round(piezasOtras ?? 0),
  }
  if (anterior === null) return { contadores: actuales, nuevas: [] }
  const al = Math.max(0, actuales.al - anterior.al)
  const pl = Math.max(0, actuales.pl - anterior.pl)
  const nuevas: Tipo[] = [
    ...Array<Tipo>(al).fill('al'),
    ...Array<Tipo>(pl).fill('pl'),
  ]
  return { contadores: actuales, nuevas: nuevas.slice(-MAXIMO_POR_CONSULTA) }
}
