// S7-1516 virtual para la simulación. Corre la misma secuencia que el tablero real y
// escribe los mismos nodos (TAB_TORRETA, TAB_PASO, TAB_EMPUJA_EXT...), así el gemelo se
// alimenta igual en simulación que en vivo.
//
// Mandos del operador (en la celda real son botones del S7-1200):
//   marcha        arranca, si no hay falla, reset ni mantenimiento
//   paro          detiene; la secuencia se queda en el paso donde iba
//   mantenimiento enclavado: mientras esté puesto, el arranque está bloqueado (torreta 2)
//   reset         3 s regresando a inicio (torreta 4): PD-1 se retrae y PD-2 abre;
//                 borra la falla y deja la celda en paro (3) esperando marcha
//
// Las fallas salen solas por tiempo: si un final de carrera no llega a tiempo, se activa
// TAB_FALLA con el código del paso (ver FALLAS). Para probarlo, trabar() atora el PD-1.
import { NODO, TORRETA, type ClaveNodo } from './nodos'
import type { Valores } from './estado'

// Códigos de falla de la simulación: el paso que no terminó a tiempo.
export const FALLAS = {
  empujador: 1, // PD-1 no llegó a TAB_FINC_EMPUJAR
  regreso: 2, // PD-1 no regresó
  sinPieza: 3, // TAB_SENSOR_C no vio la pieza
  apriete: 4, // PD-2 no llegó a TAB_FINC_APRETAR
  sello: 5, // PS no llegó a TAB_FINC_SELLO
  suelta: 6, // PD-2 no llegó a TAB_FINC_SIN_APRETAR
} as const

const LIMITE = { 2: 3, 3: 3, 4: 8, 5: 3, 6: 3, 7: 3, 8: 3 } as Record<
  number,
  number
>
const FALLA_DEL_PASO: Record<number, number> = {
  2: FALLAS.empujador,
  3: FALLAS.regreso,
  4: FALLAS.sinPieza,
  5: FALLAS.apriete,
  6: FALLAS.sello,
  7: FALLAS.sello,
  8: FALLAS.suelta,
}

export const SEGUNDOS_RESET = 3

// Lo que el PLC lee de la planta (finales de carrera y sensores).
export type Entradas = {
  ls1: boolean // PD-1 atrás (no tiene nodo en el historian)
  ls2: boolean // TAB_FINC_EMPUJAR
  ls3: boolean // TAB_FINC_APRETAR
  b0: boolean // TAB_FINC_SIN_APRETAR
  c1: boolean // TAB_FINC_SELLO
  sc1: boolean // pieza pasando por la identificación
  si1: boolean // y es metal
  sc2: boolean // pieza en la estación de sello (TAB_SENSOR_C)
  ls4: boolean // depósito ocupado
}

export type Plc1516 = {
  paso: number
  t: number // segundos en el paso
  reloj: number
  marcha: boolean
  falla: boolean
  codFalla: number
  mantenimiento: boolean
  reset: number // segundos que faltan del reset
  latido: number
  tLatido: number
  ciclos: number
  aluminio: number
  otras: number
  tCiclo: number
  tCarrera: number
  inicioCiclo: number
  esAluminio: boolean
  vioPieza: boolean
  selloAbajo: number // segundos con el sello abajo
  salidas: {
    ext: boolean
    ret: boolean
    aprieta: boolean
    suelta: boolean
    sello: boolean
  }
  valores: Valores
}

export function crearPlc1516(): Plc1516 {
  const plc: Plc1516 = {
    paso: 0,
    t: 0,
    reloj: 0,
    marcha: false,
    falla: false,
    codFalla: 0,
    mantenimiento: false,
    reset: 0,
    latido: 0,
    tLatido: 0,
    ciclos: 0,
    aluminio: 0,
    otras: 0,
    tCiclo: 0,
    tCarrera: 0,
    inicioCiclo: 0,
    esAluminio: false,
    vioPieza: false,
    selloAbajo: 0,
    salidas: {
      ext: false,
      ret: false,
      aprieta: false,
      suelta: false,
      sello: false,
    },
    valores: {},
  }
  return plc
}

export type Mando = 'marcha' | 'paro' | 'mantenimiento' | 'reset'

export function mandar(plc: Plc1516, mando: Mando) {
  switch (mando) {
    case 'marcha':
      if (!plc.falla && !plc.mantenimiento && plc.reset <= 0) plc.marcha = true
      break
    case 'paro':
      plc.marcha = false
      break
    case 'mantenimiento':
      plc.mantenimiento = !plc.mantenimiento
      if (plc.mantenimiento) plc.marcha = false
      break
    case 'reset':
      plc.reset = SEGUNDOS_RESET
      plc.marcha = false
      plc.falla = false
      plc.codFalla = 0
      plc.selloAbajo = 0
      irA(plc, 0)
      break
  }
}

function irA(plc: Plc1516, paso: number) {
  plc.paso = paso
  plc.t = 0
}

function fallar(plc: Plc1516, codigo: number) {
  plc.falla = true
  plc.codFalla = codigo
  plc.marcha = false
}

// Un ciclo de scan.
export function avanzarPlc1516(plc: Plc1516, e: Entradas, dt: number) {
  plc.reloj += dt
  plc.tLatido += dt
  // "sube 1 cada dos ejecuciones del OB30"
  if (plc.tLatido >= 0.2) {
    plc.tLatido = 0
    plc.latido = (plc.latido + 1) % 32768
  }
  const o = plc.salidas
  o.ext = o.ret = o.aprieta = o.suelta = o.sello = false

  if (plc.reset > 0) {
    // regreso a inicio
    plc.reset = Math.max(0, plc.reset - dt)
    o.ret = true
    o.suelta = true
  } else if (plc.marcha) {
    plc.t += dt
    secuencia(plc, e, dt)
    const limite = LIMITE[plc.paso]
    if (plc.marcha && limite !== undefined && plc.t > limite)
      fallar(plc, FALLA_DEL_PASO[plc.paso])
  }
  publicar(plc, e)
}

function secuencia(plc: Plc1516, e: Entradas, dt: number) {
  const o = plc.salidas
  switch (plc.paso) {
    case 0: // reposo: en la celda real también se alcanza a ver un momento
      if (plc.t > 0.2) irA(plc, 1)
      break
    case 1: // arranque
      if (plc.t > 0.3) {
        plc.inicioCiclo = plc.reloj
        plc.vioPieza = plc.esAluminio = false
        irA(plc, 2)
      }
      break
    case 2: // empuja
      o.ext = true
      if (e.ls2) {
        plc.tCarrera = plc.t
        irA(plc, 3)
      }
      break
    case 3: // regresa; la pieza baja por la guía y pasa por la identificación
      o.ret = true
      identificar(plc, e)
      if (e.ls1) irA(plc, 4)
      break
    case 4: // detecta: la pieza llegó a la estación de sello
      identificar(plc, e)
      if (e.sc2 && plc.t > 0.2) {
        plc.ciclos++
        if (plc.esAluminio) plc.aluminio++
        else plc.otras++
        irA(plc, 5)
      }
      break
    case 5: // aprieta
      o.aprieta = true
      if (e.ls3) irA(plc, plc.esAluminio ? 6 : 7)
      break
    case 6:
    case 7: // sello: baja, se queda un momento abajo y el resorte lo sube
      if (e.c1) plc.selloAbajo += dt
      o.sello = plc.selloAbajo < 0.25
      if (plc.selloAbajo >= 0.25 && !e.c1) {
        plc.selloAbajo = 0
        irA(plc, 8)
      }
      break
    case 8: // suelta
      o.suelta = true
      if (e.b0) irA(plc, 9)
      break
    case 9: // fin: el tope deja pasar la pieza al depósito cuando está libre
      if (!e.sc2 && plc.t > 0.45) {
        plc.tCiclo = plc.reloj - plc.inicioCiclo
        irA(plc, 0)
      }
      // si el depósito sigue ocupado, se espera sin contar tiempo de falla
      if (e.ls4) plc.t = Math.min(plc.t, 0.1)
      break
  }
}

function identificar(plc: Plc1516, e: Entradas) {
  if (!e.sc1) return
  plc.vioPieza = true
  if (e.si1) plc.esAluminio = true
}

function torreta(plc: Plc1516): number {
  if (plc.reset > 0) return TORRETA.reset
  if (plc.mantenimiento) return TORRETA.mantenimiento
  if (plc.marcha && !plc.falla) return TORRETA.marcha
  return TORRETA.paro
}

const b = (x: boolean) => (x ? 1 : 0)

function publicar(plc: Plc1516, e: Entradas) {
  const o = plc.salidas
  const v: Record<ClaveNodo, number> = {
    torreta: torreta(plc),
    latido: plc.latido,
    paso: plc.paso,
    marcha: b(plc.marcha),
    falla: b(plc.falla),
    codFalla: plc.codFalla,
    ciclos: plc.ciclos,
    aluminio: plc.aluminio,
    otras: plc.otras,
    tCiclo: Math.round(plc.tCiclo * 100) / 100,
    tCarreraPd1: Math.round(plc.tCarrera * 100) / 100,
    empujaExt: b(o.ext),
    empujaRet: b(o.ret),
    aprieta: b(o.aprieta),
    suelta: b(o.suelta),
    sello: b(o.sello),
    fincEmpujar: b(e.ls2),
    fincApretar: b(e.ls3),
    fincSinApretar: b(e.b0),
    fincSello: b(e.c1),
    sensorC: b(e.sc2),
    sensorI: b(e.si1),
    esAluminio: b(plc.esAluminio),
  }
  for (const clave of Object.keys(v) as ClaveNodo[])
    plc.valores[NODO[clave]] = v[clave]
}
