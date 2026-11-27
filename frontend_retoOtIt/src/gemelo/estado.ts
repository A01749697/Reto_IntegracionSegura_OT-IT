// El estado de la celda y las luces de la torreta, a partir de los valores de los nodos del
// S7-1516. Sirve igual en vivo (valores del historian) que en simulación (S7-1516 virtual).
import { NODO, SEGUNDOS_SIN_LATIDO, TORRETA } from './nodos'

// Valor de cada nodo, por su nombre (TAB_PASO, TAB_SELLO...). Bool = 1 / 0.
export type Valores = Record<string, number>

export type EstadoCelda =
  | 'marcha'
  | 'mantenimiento'
  | 'reset'
  | 'paro'
  | 'falla'
  | 'sinDato'
  | 'sinComunicacion'

export const encendido = (valores: Valores, nodo: string) => valores[nodo] === 1

export function estadoCelda(
  valores: Valores,
  sinComunicacion: boolean,
): EstadoCelda {
  if (sinComunicacion) return 'sinComunicacion'
  switch (valores[NODO.torreta]) {
    case TORRETA.marcha:
      return 'marcha'
    case TORRETA.mantenimiento:
      return 'mantenimiento'
    case TORRETA.reset:
      return 'reset'
    case TORRETA.paro:
      return encendido(valores, NODO.falla) ? 'falla' : 'paro'
    default:
      return 'sinDato'
  }
}

export type Luces = {
  verde: boolean
  amarilla: boolean
  roja: boolean
  gris: boolean // sin comunicación: la torreta del modelo se ve apagada y gris
}

// Una sola luz a la vez. El reset parpadea en amarillo a 1 Hz (medio segundo prendida).
export function lucesTorreta(
  torreta: number | undefined,
  sinComunicacion: boolean,
  reloj: number,
): Luces {
  const apagadas = { verde: false, amarilla: false, roja: false }
  if (sinComunicacion) return { ...apagadas, gris: true }
  const parpadeo = reloj % 1 < 0.5
  return {
    verde: torreta === TORRETA.marcha,
    amarilla:
      torreta === TORRETA.mantenimiento ||
      (torreta === TORRETA.reset && parpadeo),
    roja: torreta === TORRETA.paro,
    gris: false,
  }
}

// Vigila que LATIDO cambie. cambio: reloj del gemelo (segundos) de la última vez que cambió.
// Se vigila desde la primera vez que se le ve cambiar: si el colector no lo guarda, su
// valor nunca cambia y no se puede saber si hay comunicación (se avisa aparte).
export type Latido = {
  valor: number | undefined
  cambio: number
  vigilado: boolean
}

export function vigilarLatido(
  latido: Latido,
  valor: number | undefined,
  reloj: number,
): Latido {
  if (valor === undefined || valor === latido.valor) return latido
  return {
    valor,
    cambio: reloj,
    vigilado: latido.vigilado || latido.valor !== undefined,
  }
}

export const sinLatido = (latido: Latido, reloj: number) =>
  latido.vigilado && reloj - latido.cambio > SEGUNDOS_SIN_LATIDO
