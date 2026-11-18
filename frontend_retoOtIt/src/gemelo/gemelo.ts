// Junta las señales, la planta y el PLC simulado, y los hace avanzar en el tiempo.
import {
  avanzarPlanta,
  crearPlanta,
  despejarLinea,
  estaEmpacando,
  type Planta,
} from './planta'
import { apagarSalidas, avanzarPlc, crearPlc, irA, type Plc } from './plc'
import { senalesIniciales, type Senales } from './senales'

// 'vivo': cada pieza que cuenta el PLC real dispara un ciclo.
// 'simulacion': la persona maneja la celda con los mandos.
export type Modo = 'vivo' | 'simulacion'

export type Mando = 'marcha' | 'paro' | 'emergencia' | 'restablecer'

export type Gemelo = {
  senales: Senales
  planta: Planta
  plc: Plc
  modo: Modo
  velocidad: number
  ciclosPedidos: number // solo cuenta en modo 'vivo'
  acumulado: number
}

// Lo que necesita la pantalla en cada refresco.
export type Instantanea = Senales & { empacando: boolean }

const PASO_FIJO = 1 / 120
// Si la celda real va mas rapido que el gemelo, no se acumulan ciclos sin fin.
export const MAXIMO_CICLOS_PENDIENTES = 3

export function crearGemelo(
  modo: Modo = 'vivo',
  azar: () => number = Math.random,
): Gemelo {
  const gemelo: Gemelo = {
    senales: senalesIniciales(),
    planta: crearPlanta(azar),
    plc: crearPlc(),
    modo,
    velocidad: 1,
    ciclosPedidos: 0,
    acumulado: 0,
  }
  ponerModo(gemelo, modo)
  return gemelo
}

function restablecer(gemelo: Gemelo) {
  const { senales, planta, plc } = gemelo
  senales.emergencia = false
  senales.marcha = false
  senales.material = ''
  apagarSalidas(senales)
  irA(plc, 'REPOSO')
  despejarLinea(planta)
  gemelo.ciclosPedidos = plc.ciclos
}

// La simulacion arranca andando; en vivo espera a las lecturas.
export function ponerModo(gemelo: Gemelo, modo: Modo) {
  restablecer(gemelo)
  gemelo.modo = modo
  gemelo.senales.marcha = modo === 'simulacion'
}

export function ponerVelocidad(gemelo: Gemelo, velocidad: number) {
  gemelo.velocidad = velocidad
}

// Los mandos solo mueven la simulacion: el panel nunca le manda ordenes a la celda real.
export function pulsar(gemelo: Gemelo, mando: Mando) {
  if (gemelo.modo !== 'simulacion') return
  const { senales } = gemelo
  if (mando === 'marcha') {
    if (!senales.emergencia) senales.marcha = true
  } else if (mando === 'paro') {
    senales.marcha = false
  } else if (mando === 'emergencia') {
    senales.emergencia = true
    senales.marcha = false
  } else {
    restablecer(gemelo)
  }
}

// En vivo: el PLC real conto piezas nuevas, el gemelo hace un ciclo por cada una.
export function pedirCiclos(gemelo: Gemelo, cuantos: number) {
  if (gemelo.modo !== 'vivo' || cuantos <= 0) return
  gemelo.ciclosPedidos = Math.min(
    Math.max(gemelo.ciclosPedidos, gemelo.plc.ciclos) + cuantos,
    gemelo.plc.ciclos + MAXIMO_CICLOS_PENDIENTES,
  )
}

// Avanza con paso fijo para que la secuencia salga igual sin importar los cuadros por segundo.
export function avanzarGemelo(gemelo: Gemelo, segundos: number) {
  const { senales, planta, plc } = gemelo
  gemelo.acumulado = Math.min(
    gemelo.acumulado + segundos * gemelo.velocidad,
    0.5,
  )
  while (gemelo.acumulado >= PASO_FIJO) {
    if (gemelo.modo === 'vivo')
      senales.marcha = plc.ciclos < gemelo.ciclosPedidos
    avanzarPlc(plc, senales, planta.cajas, PASO_FIJO)
    avanzarPlanta(planta, senales, PASO_FIJO)
    gemelo.acumulado -= PASO_FIJO
  }
}

export function tomarInstantanea(gemelo: Gemelo): Instantanea {
  return { ...gemelo.senales, empacando: estaEmpacando(gemelo.planta) }
}
