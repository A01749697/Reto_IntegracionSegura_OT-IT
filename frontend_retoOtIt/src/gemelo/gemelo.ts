// Junta las señales, la planta y los PLC simulados, y los hace avanzar en el tiempo.
// No hay mandos: el proceso de pistones arranca y se detiene con la torreta
// (verde = marcha, roja = paro). La garra no depende de la torreta.
import {
  avanzarPlanta,
  crearPlanta,
  despejarLinea,
  estaEmpacando,
  type Planta,
} from './planta'
import {
  apagarSalidas,
  avanzarPlc,
  crearPlc,
  reiniciarPlc,
  type Plc,
} from './plc'
import { senalesIniciales, type Senales } from './senales'

// 'vivo': la torreta real (S7-1200) decide si los pistones trabajan.
// 'simulacion': la torreta la elige la persona en la pantalla.
export type Modo = 'vivo' | 'simulacion'

export type Gemelo = {
  senales: Senales
  planta: Planta
  plc: Plc
  modo: Modo
  velocidad: number
  acumulado: number
}

// Lo que necesita la pantalla en cada refresco.
export type Instantanea = Senales & { empacando: boolean }

const PASO_FIJO = 1 / 120

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
    acumulado: 0,
  }
  ponerModo(gemelo, modo)
  return gemelo
}

// Al cambiar de modo se empieza limpio: la linea vacia y la torreta en rojo.
export function ponerModo(gemelo: Gemelo, modo: Modo) {
  const { senales, planta, plc } = gemelo
  senales.marcha = false
  senales.material = ''
  senales.materialGarra = ''
  apagarSalidas(senales)
  reiniciarPlc(plc)
  despejarLinea(planta)
  gemelo.modo = modo
  // la simulacion arranca andando; en vivo espera a la torreta real
  senales.marcha = modo === 'simulacion'
}

export function ponerVelocidad(gemelo: Gemelo, velocidad: number) {
  gemelo.velocidad = velocidad
}

// La torreta: verde = marcha, roja = paro. Solo detiene a los pistones;
// si hay una pieza a medio camino, la terminan antes de quedarse en reposo.
export function ponerTorreta(gemelo: Gemelo, verde: boolean) {
  gemelo.senales.marcha = verde
}

// Avanza con paso fijo para que la secuencia salga igual sin importar los cuadros por segundo.
export function avanzarGemelo(gemelo: Gemelo, segundos: number) {
  const { senales, planta, plc } = gemelo
  gemelo.acumulado = Math.min(
    gemelo.acumulado + segundos * gemelo.velocidad,
    0.5,
  )
  while (gemelo.acumulado >= PASO_FIJO) {
    avanzarPlc(plc, senales, planta.cajas, PASO_FIJO)
    avanzarPlanta(planta, senales, PASO_FIJO)
    gemelo.acumulado -= PASO_FIJO
  }
}

export function tomarInstantanea(gemelo: Gemelo): Instantanea {
  return { ...gemelo.senales, empacando: estaEmpacando(gemelo.planta) }
}
