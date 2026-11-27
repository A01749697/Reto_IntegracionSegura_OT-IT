// Junta las señales, la planta y los PLC, y los hace avanzar en el tiempo. No hay mandos.
//   - Simulación: los pistones son un PLC simulado que arranca y se detiene con la torreta
//     (verde = marcha, roja = paro) y el material de cada pieza es al azar.
//   - En vivo: los pistones siguen a TAB_PASO, el paso real del S7-1516, unos segundos
//     después (ver repeticion.ts y seguidor.ts). El material de cada pieza sale de los
//     contadores TAB_ALUMINIO / TAB_OTRAS; mientras no se sabe, la pieza se ve gris.
// La garra es simulada en los dos modos y trabaja sola cuando hay pieza en el depósito.
import { ESTADOS_TORRETA, NODOS_EMPUJADOR } from './nodos'
import {
  avanzarPlanta,
  crearPlanta,
  despejarLinea,
  estaEmpacando,
  identificarEnLinea,
  limpiarDeposito,
  pintarAlmacen,
  type Planta,
  prepararDeposito,
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
  recibirNodo,
  recibirPasos,
  valoresEn,
  type PuntoPaso,
  type Repeticion,
} from './repeticion'
import {
  crearVigiaGarra,
  hayDatosDeGarra,
  vigilarGarra,
  type VigiaGarra,
} from './garraReal'
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
  vigiaGarra: VigiaGarra // en vivo, lo que va haciendo la garra real (S7-300)
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
    vigiaGarra: crearVigiaGarra(),
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
  gemelo.vigiaGarra = crearVigiaGarra()
  pintarAlmacen(planta, [])
  // la simulación arranca en verde; en vivo la torreta real solo prende las luces
  ponerTorreta(gemelo, modo === 'simulacion' ? ESTADOS_TORRETA.verde : null)
}

export function ponerVelocidad(gemelo: Gemelo, velocidad: number) {
  gemelo.velocidad = velocidad
}

// La torreta (valor de TAB_TORRETA): solo el verde es marcha. En simulación, cualquier otro
// detiene a los pistones (si hay una pieza a medio camino, la terminan); en vivo solo
// prende las luces.
export function ponerTorreta(gemelo: Gemelo, valor: number | null) {
  gemelo.senales.torreta = valor
  gemelo.senales.marcha = valor === ESTADOS_TORRETA.verde
}

// Los cambios de TAB_PASO que trajo la última consulta al historial.
export function recibirPasosReales(
  gemelo: Gemelo,
  puntos: readonly PuntoPaso[],
) {
  if (gemelo.modo !== 'vivo') return
  recibirPasos(gemelo.repeticion, puntos, gemelo.reloj)
}

// Los cambios de otro nodo que se repite junto con el paso (las salidas del empujador).
export function recibirNodoReal(
  gemelo: Gemelo,
  nodo: string,
  puntos: readonly PuntoPaso[],
) {
  if (gemelo.modo !== 'vivo') return
  recibirNodo(gemelo.repeticion, nodo, puntos, gemelo.reloj)
}

// El paso en que está la celda según la última lectura. Solo sirve mientras el historial
// todavía no dice nada: así el gemelo muestra dónde quedó aunque la celda no se mueva.
export function ponerPasoInicial(gemelo: Gemelo, paso: number | null) {
  if (gemelo.modo !== 'vivo' || paso === null) return
  if (gemelo.repeticion.paso === null && gemelo.repeticion.eventos.length === 0)
    gemelo.repeticion.paso = paso
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
  const valores = vivo ? valoresEn(gemelo.repeticion, gemelo.reloj) : {}
  // en vivo, cada vez que la pinza real cierra es un trabajo para la garra del gemelo
  plc.garra.porTrabajos = vivo && hayDatosDeGarra(valores)
  if (plc.garra.porTrabajos)
    vigilarGarra(gemelo.vigiaGarra, valores, plc.garra.trabajos)
  const empujador = {
    ext: valores[NODOS_EMPUJADOR.ext.nodo],
    ret: valores[NODOS_EMPUJADOR.ret.nodo],
  }
  while (gemelo.acumulado >= PASO_FIJO) {
    if (vivo)
      avanzarSeguidor(
        gemelo.seguidor,
        objetivo,
        senales,
        materialEnProceso(planta),
        PASO_FIJO,
        empujador,
      )
    const enAlmacen = contarAlmacen(planta)
    if (vivo && plc.garra.porTrabajos) {
      limpiarDeposito(planta)
      const [siguiente] = plc.garra.trabajos
      if (plc.garra.estado === 'REPOSO' && siguiente)
        prepararDeposito(planta, siguiente.material)
    }
    avanzarPlc(plc, senales, planta.carriles, PASO_FIJO, !vivo)
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
