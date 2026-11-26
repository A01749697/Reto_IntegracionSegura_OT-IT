// Junta las señales, la planta y los PLC simulados, y los hace avanzar en el tiempo.
// No hay mandos. En simulación los pistones arrancan y se detienen con la torreta
// (verde = marcha, roja = paro). En vivo meten una pieza cada vez que los contadores
// del S7-1516 (TAB_ALUMINIO / TAB_OTRAS) suben, con el material real. La garra no
// depende de la torreta.
import {
  avanzarPlanta,
  crearPlanta,
  despejarLinea,
  estaEmpacando,
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
import { senalesIniciales, type Senales } from './senales'

// 'vivo': entran las piezas que cuenta el S7-1516; la torreta real solo se muestra.
// 'simulacion': la torreta la elige la persona en la pantalla y el material es al azar.
export type Modo = 'vivo' | 'simulacion'

export type Gemelo = {
  senales: Senales
  planta: Planta
  plc: Plc
  modo: Modo
  velocidad: number
  acumulado: number
  porEntrar: Tipo[] // en vivo: piezas reales contadas que aún no entran
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
    porEntrar: [],
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
  gemelo.porEntrar = []
  if (modo === 'vivo') pintarAlmacen(planta, [])
  else planta.almacenVisible = null
  // la simulacion arranca andando; en vivo espera a la torreta real
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

// Las piezas que el S7-1516 contó desde la consulta anterior. Solo cuenta en vivo.
export const MAXIMO_POR_ENTRAR = 6

export function meterPiezas(gemelo: Gemelo, tipos: readonly Tipo[]) {
  if (gemelo.modo !== 'vivo' || tipos.length === 0) return
  gemelo.porEntrar = [...gemelo.porEntrar, ...tipos].slice(-MAXIMO_POR_ENTRAR)
  pintarAlmacen(gemelo.planta, gemelo.porEntrar)
}

const contarAlmacen = (planta: Planta) =>
  planta.piezas.filter((p) => p.estado === 'almacen').length

// Si se juntan piezas reales por meter, el gemelo se apura para no quedarse atrás.
function apuro(gemelo: Gemelo): number {
  if (gemelo.modo !== 'vivo') return 1
  return Math.min(3, 1 + 0.5 * Math.max(0, gemelo.porEntrar.length - 1))
}

// Avanza con paso fijo para que la secuencia salga igual sin importar los cuadros por segundo.
export function avanzarGemelo(gemelo: Gemelo, segundos: number) {
  const { senales, planta, plc } = gemelo
  gemelo.acumulado = Math.min(
    gemelo.acumulado + segundos * gemelo.velocidad * apuro(gemelo),
    0.5,
  )
  while (gemelo.acumulado >= PASO_FIJO) {
    const vivo = gemelo.modo === 'vivo'
    senales.porEntrar = vivo ? gemelo.porEntrar.length : null
    const enAlmacen = contarAlmacen(planta)
    avanzarPlc(plc, senales, planta.cajas, PASO_FIJO)
    avanzarPlanta(planta, senales, PASO_FIJO)
    // la pieza real ya salió del almacén (no al empezar el ciclo, que es un paso antes):
    // se quita de la fila y las de abajo toman los materiales que siguen
    if (vivo && contarAlmacen(planta) < enAlmacen) {
      gemelo.porEntrar = gemelo.porEntrar.slice(1)
      pintarAlmacen(planta, gemelo.porEntrar)
    }
    gemelo.acumulado -= PASO_FIJO
  }
}

export function tomarInstantanea(gemelo: Gemelo): Instantanea {
  return { ...gemelo.senales, empacando: estaEmpacando(gemelo.planta) }
}
