// De las salidas del S7-1516 al movimiento de los pistones del modelo. Se usan las salidas,
// no el número de paso:
//   PD-1 (empuja, doble efecto)  TAB_EMPUJA_EXT sale · TAB_EMPUJA_RET entra
//   PD-2 (aprieta, doble efecto) TAB_APRIETA cierra · TAB_SUELTA abre
//   PS (sello, simple efecto)    TAB_SELLO baja; sin la salida, el resorte lo sube
// Los de doble efecto se quedan donde están cuando ninguna de sus dos salidas está activa.
//
// El tope del depósito no tiene salida en el historian: se abre cuando la pieza ya está
// sellada y PD-2 la soltó (o en el paso 9), y el depósito está libre.
import { encendido, type Valores } from './estado'
import { NODO, SELLO_POR_PASO } from './nodos'
import type { Senales } from './senales'

export type Actuadores = {
  pd1: boolean // PD-1 afuera
  pd2: boolean // PD-2 cerrado
  sello: number // segundos que le faltan al pulso mínimo del sello
  selloAntes: boolean
  paso: number | null
  tope: boolean
  tTope: number
}

// El colector lee cada segundo: un pulso de sello más corto que eso puede llegar como un
// solo valor. El modelo lo deja abajo al menos esto, para que se vea la marca.
const PULSO_SELLO = 0.45

// Paso real -> paso del gemelo (1 alimentar, 2 identificar, 3 sujetar y marcar, 4 depósito).
const PASO_GEMELO: Record<number, number> = {
  2: 1,
  3: 1,
  4: 2,
  5: 3,
  6: 3,
  7: 3,
  8: 4,
  9: 4,
}

export function crearActuadores(): Actuadores {
  return {
    pd1: false,
    pd2: false,
    sello: 0,
    selloAntes: false,
    paso: null,
    tope: false,
    tTope: 0,
  }
}

export function avanzarActuadores(
  a: Actuadores,
  v: Valores,
  s: Senales,
  piezaSelladaEnTope: boolean,
  dt: number,
) {
  const ext = encendido(v, NODO.empujaExt)
  const ret = encendido(v, NODO.empujaRet)
  if (ext && !ret) a.pd1 = true
  else if (ret && !ext) a.pd1 = false
  const aprieta = encendido(v, NODO.aprieta)
  const suelta = encendido(v, NODO.suelta)
  if (aprieta && !suelta) a.pd2 = true
  else if (suelta && !aprieta) a.pd2 = false

  const paso = v[NODO.paso] ?? null
  if (paso !== a.paso) {
    if (paso === 2) s.material = ''
    // el paso de sello dice qué sello es, aunque el pulso no haya quedado en el historian
    if (paso === 6 || paso === 7) {
      s.material = SELLO_POR_PASO[paso]
      a.sello = PULSO_SELLO
    }
    a.paso = paso
  }
  const sello = encendido(v, NODO.sello)
  if (sello && !a.selloAntes) {
    a.sello = PULSO_SELLO
    if (paso !== 6 && paso !== 7)
      s.material = encendido(v, NODO.esAluminio) ? 'al' : 'pl'
  }
  a.selloAntes = sello
  a.sello = Math.max(0, a.sello - dt)

  if (
    !a.tope &&
    !s.ls4 &&
    (paso === 9 || (piezaSelladaEnTope && s.b0 && !a.pd2))
  ) {
    a.tope = true
    a.tTope = 0
  }
  if (a.tope) {
    a.tTope += dt
    if (a.tTope > 0.45 && !s.sc2) a.tope = false
  }

  s.yA = a.pd1
  s.yB = a.pd2
  s.yC = sello || a.sello > 0
  s.yT = a.tope
  s.marcha = encendido(v, NODO.marcha)
  s.pasoReal = paso
  s.paso = paso === null ? 0 : (PASO_GEMELO[paso] ?? 0)
}
