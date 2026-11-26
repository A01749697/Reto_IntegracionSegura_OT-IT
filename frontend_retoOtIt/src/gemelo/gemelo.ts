// Junta las señales, la planta y los PLC, y los hace avanzar en el tiempo. No hay mandos.
//   - Simulación: los pistones son un PLC simulado que arranca y se detiene con la torreta
//     (verde = marcha, roja = paro) y el material de cada pieza es al azar.
//   - En vivo: los pistones siguen a TAB_PASO, el paso real del S7-1516, unos segundos
//     después (ver repeticion.ts y seguidor.ts). El material de cada pieza sale de los
//     contadores TAB_ALUMINIO / TAB_OTRAS; mientras no se sabe, la pieza se ve gris.
// La garra es simulada en los dos modos y trabaja sola cuando hay pieza en el depósito.
import {
  avanzarPlanta,
  crearPlanta,
  despejarLinea,
  estaEmpacando,
  identificarEnLinea,
  pintarAlmacen,
  type Planta,
  type Tipo,
} from './planta'
import {
  apagarSalidas,
  avanzarPlc,
  crearPlc,
  reiniciarPlc,
  type Plc,
} from './plc'
import {
  crearRepeticion,
  pasoEn,
  recibirPasos,
  type PuntoPaso,
  type Repeticion,
} from './repeticion'
import { avanzarSeguidor, crearSeguidor, type Seguidor } from './seguidor'
import { senalesIniciales, type Senales } from './senales'

export type Modo = 'vivo' | 'simulacion'

export type Gemelo = {
  senales: Senales
  planta: Planta
  plc: Plc
  modo: Modo
  velocidad: number
  acumulado: number
  reloj: number // segundos de tiempo real desde que se creó (no lo afecta la velocidad)
  porEntrar: Tipo[] // en vivo: materiales ya contados que aún no tienen pieza
  repeticion: Repeticion
  seguidor: Seguidor
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
    reloj: 0,
    porEntrar: [],
    repeticion: crearRepeticion(),
    seguidor: crearSeguidor(),
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
  senales.pasoReal = null
  senales.paso = 0
  apagarSalidas(senales)
  reiniciarPlc(plc)
  gemelo.modo = modo
  planta.enVivo = modo === 'vivo'
  despejarLinea(planta)
  gemelo.porEntrar = []
  gemelo.repeticion = crearRepeticion()
  gemelo.seguidor = crearSeguidor()
  pintarAlmacen(planta, [])
  // la simulacion arranca andando; en vivo la torreta real solo prende las luces
  senales.marcha = modo === 'simulacion'
}

export function ponerVelocidad(gemelo: Gemelo, velocidad: number) {
  gemelo.velocidad = velocidad
}

// La torreta: verde = marcha, roja = paro. En simulación detiene a los pistones (si hay
// una pieza a medio camino, la terminan); en vivo solo prende las luces.
export function ponerTorreta(gemelo: Gemelo, verde: boolean) {
  gemelo.senales.marcha = verde
}

// Los cambios de TAB_PASO que trajo la última consulta al historial.
export function recibirPasosReales(
  gemelo: Gemelo,
  puntos: readonly PuntoPaso[],
) {
  if (gemelo.modo !== 'vivo') return
  recibirPasos(gemelo.repeticion, puntos, gemelo.reloj)
}

// Las piezas que el S7-1516 contó desde la consulta anterior. Si ya hay una pieza gris en
// la línea, toma ese material; si no, lo toma la siguiente que salga del almacén.
export const MAXIMO_POR_ENTRAR = 6

export function meterPiezas(gemelo: Gemelo, tipos: readonly Tipo[]) {
  if (gemelo.modo !== 'vivo') return
  for (const tipo of tipos) {
    if (!identificarEnLinea(gemelo.planta, tipo)) gemelo.porEntrar.push(tipo)
  }
  gemelo.porEntrar = gemelo.porEntrar.slice(-MAXIMO_POR_ENTRAR)
  pintarAlmacen(gemelo.planta, gemelo.porEntrar)
}

const contarAlmacen = (planta: Planta) =>
  planta.piezas.filter((p) => p.estado === 'almacen').length

// El material de la pieza que está en proceso, si ya se sabe.
function materialEnProceso(planta: Planta): Tipo | null {
  const pieza = planta.ultimaSacada
  return pieza && pieza.conocida ? pieza.tipo : null
}

// Avanza con paso fijo para que la secuencia salga igual sin importar los cuadros por segundo.
export function avanzarGemelo(gemelo: Gemelo, segundos: number) {
  const { senales, planta, plc } = gemelo
  const vivo = gemelo.modo === 'vivo'
  gemelo.reloj += segundos
  // en vivo manda el ritmo real de la celda: la velocidad solo cuenta en simulación
  gemelo.acumulado = Math.min(
    gemelo.acumulado + segundos * (vivo ? 1 : gemelo.velocidad),
    0.5,
  )
  const objetivo = vivo ? pasoEn(gemelo.repeticion, gemelo.reloj) : null
  while (gemelo.acumulado >= PASO_FIJO) {
    if (vivo)
      avanzarSeguidor(
        gemelo.seguidor,
        objetivo,
        senales,
        materialEnProceso(planta),
        PASO_FIJO,
      )
    const enAlmacen = contarAlmacen(planta)
    avanzarPlc(plc, senales, planta.cajas, PASO_FIJO, !vivo)
    avanzarPlanta(planta, senales, PASO_FIJO)
    // salió una pieza del almacén: si ya se había contado, se lleva ese material
    if (vivo && contarAlmacen(planta) < enAlmacen && gemelo.porEntrar.length) {
      gemelo.porEntrar = gemelo.porEntrar.slice(1)
      pintarAlmacen(planta, gemelo.porEntrar)
    }
    gemelo.acumulado -= PASO_FIJO
  }
}

export function tomarInstantanea(gemelo: Gemelo): Instantanea {
  return { ...gemelo.senales, empacando: estaEmpacando(gemelo.planta) }
}
