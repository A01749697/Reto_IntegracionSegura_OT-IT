// Junta las señales, la planta y los PLC, y los hace avanzar en el tiempo.
// Los pistones y la torreta salen siempre de los valores de los nodos del S7-1516:
//   - En vivo: los cambios del historian, repetidos unos segundos después (repeticion.ts).
//   - Simulación: un S7-1516 virtual con la misma secuencia, estados y códigos (s7_1516.ts).
// La garra es simulada en los dos modos. El material de cada pieza sale de los contadores
// TAB_ALUMINIO / TAB_OTRAS; en vivo, mientras no se sabe, la pieza se ve gris.
import {
  avanzarActuadores,
  crearActuadores,
  type Actuadores,
} from './actuadores'
import {
  estadoCelda,
  lucesTorreta,
  sinLatido,
  vigilarLatido,
  type Latido,
  type Valores,
} from './estado'
import { NODO } from './nodos'
import {
  avanzarPlanta,
  crearPlanta,
  despejarLinea,
  estaEmpacando,
  identificarEnLinea,
  piezaSelladaEnTope,
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
  recibirCambios,
  sembrar,
  valoresEn,
  type Cambio,
  type Repeticion,
} from './repeticion'
import {
  avanzarPlc1516,
  crearPlc1516,
  mandar,
  type Mando,
  type Plc1516,
} from './s7_1516'
import { senalesIniciales, type Senales } from './senales'

export type Modo = 'vivo' | 'simulacion'

export type Gemelo = {
  senales: Senales
  planta: Planta
  plc: Plc // la garra
  s7: Plc1516 // el S7-1516 virtual (simulación)
  modo: Modo
  velocidad: number
  acumulado: number
  reloj: number // segundos de tiempo real desde que se creó (no lo afecta la velocidad)
  valores: Valores // lo que dicen ahora los nodos del S7-1516
  latido: Latido
  enlace: boolean // en vivo: el panel responde a las consultas
  retraso: number | null // en vivo: segundos que va detrás de la celda (aprox.)
  comunicacion: boolean // simulación: se puede cortar para probar el aviso
  contadores: { al: number; pl: number } | null
  porEntrar: Tipo[] // en vivo: materiales ya contados que aún no tienen pieza
  repeticion: Repeticion
  actuadores: Actuadores
}

// Lo que necesita la pantalla en cada refresco.
export type Instantanea = Senales & {
  empacando: boolean
  valores: Valores
  retraso: number | null
  segundosSinLatido: number // segundos desde que LATIDO cambió (o desde que empezó)
}

const PASO_FIJO = 1 / 120

export function crearGemelo(
  modo: Modo = 'vivo',
  azar: () => number = Math.random,
): Gemelo {
  const gemelo: Gemelo = {
    senales: senalesIniciales(),
    planta: crearPlanta(azar),
    plc: crearPlc(),
    s7: crearPlc1516(),
    modo,
    velocidad: 1,
    acumulado: 0,
    reloj: 0,
    valores: {},
    latido: { valor: undefined, cambio: 0, vigilado: false },
    enlace: true,
    retraso: null,
    comunicacion: true,
    contadores: null,
    porEntrar: [],
    repeticion: crearRepeticion(),
    actuadores: crearActuadores(),
  }
  ponerModo(gemelo, modo)
  return gemelo
}

// Al cambiar de modo se empieza limpio: la línea vacía y sin datos.
export function ponerModo(gemelo: Gemelo, modo: Modo) {
  const { senales, planta, plc } = gemelo
  Object.assign(senales, {
    material: '',
    materialGarra: '',
    pasoReal: null,
    paso: 0,
  })
  apagarSalidas(senales)
  reiniciarPlc(plc)
  gemelo.modo = modo
  planta.enVivo = modo === 'vivo'
  planta.atasco = false
  despejarLinea(planta)
  gemelo.porEntrar = []
  gemelo.contadores = null
  gemelo.repeticion = crearRepeticion()
  gemelo.actuadores = crearActuadores()
  gemelo.s7 = crearPlc1516()
  gemelo.valores = {}
  gemelo.comunicacion = true
  gemelo.enlace = true
  gemelo.retraso = null
  // el S7-1516 virtual siempre tiene latido: en simulación se vigila desde el arranque
  gemelo.latido = {
    valor: undefined,
    cambio: gemelo.reloj,
    vigilado: modo === 'simulacion',
  }
  pintarAlmacen(planta, [])
  if (modo === 'simulacion') mandar(gemelo.s7, 'marcha')
  actualizarEstado(gemelo)
}

export function ponerVelocidad(gemelo: Gemelo, velocidad: number) {
  gemelo.velocidad = velocidad
}

// Simulación: los botones del operador.
export type MandoSimulado = Mando | 'atasco' | 'comunicacion'

export function mandarSimulacion(gemelo: Gemelo, mando: MandoSimulado) {
  if (gemelo.modo !== 'simulacion') return
  if (mando === 'atasco') gemelo.planta.atasco = !gemelo.planta.atasco
  else if (mando === 'comunicacion') gemelo.comunicacion = !gemelo.comunicacion
  else {
    // el reset es también cuando el operador destraba lo que se atoró
    if (mando === 'reset') gemelo.planta.atasco = false
    mandar(gemelo.s7, mando)
  }
}

// En vivo: los valores de partida (la lectura más reciente de cada nodo del S7-1516).
export function sembrarValores(
  gemelo: Gemelo,
  valores: Valores,
  hastaMs: number,
) {
  if (gemelo.modo !== 'vivo' || gemelo.repeticion.sembrada) return
  sembrar(gemelo.repeticion, valores, hastaMs)
  // la torreta y el letrero muestran la última lectura sin esperar al siguiente cuadro
  gemelo.valores = gemelo.repeticion.valores
  actualizarEstado(gemelo)
}

// En vivo: si el panel responde. Si deja de hacerlo, la celda queda sin comunicación.
export function ponerEnlace(gemelo: Gemelo, responde: boolean) {
  gemelo.enlace = responde
}

// En vivo: los cambios que trajo la última consulta.
export function recibirCambiosReales(
  gemelo: Gemelo,
  cambios: readonly Cambio[],
) {
  if (gemelo.modo !== 'vivo') return
  recibirCambios(gemelo.repeticion, cambios, gemelo.reloj)
}

// Las piezas que el S7-1516 contó. Si ya hay una pieza gris en la línea, toma ese material;
// si no, lo toma la siguiente que salga del almacén.
export const MAXIMO_POR_ENTRAR = 6

export function meterPiezas(gemelo: Gemelo, tipos: readonly Tipo[]) {
  if (gemelo.modo !== 'vivo') return
  for (const tipo of tipos) {
    if (!identificarEnLinea(gemelo.planta, tipo)) gemelo.porEntrar.push(tipo)
  }
  gemelo.porEntrar = gemelo.porEntrar.slice(-MAXIMO_POR_ENTRAR)
  pintarAlmacen(gemelo.planta, gemelo.porEntrar)
}

// En vivo, cada vez que sube un contador entra una pieza de ese material. La primera vez
// solo se toma la referencia; si un contador baja, se reinició.
function contarPiezas(gemelo: Gemelo) {
  const al = gemelo.valores[NODO.aluminio]
  const pl = gemelo.valores[NODO.otras]
  if (al === undefined && pl === undefined) return
  const ahora = { al: Math.round(al ?? 0), pl: Math.round(pl ?? 0) }
  const antes = gemelo.contadores
  gemelo.contadores = ahora
  if (antes === null) return
  const nuevas: Tipo[] = [
    ...Array<Tipo>(Math.max(0, ahora.al - antes.al)).fill('al'),
    ...Array<Tipo>(Math.max(0, ahora.pl - antes.pl)).fill('pl'),
  ]
  if (nuevas.length) meterPiezas(gemelo, nuevas.slice(-MAXIMO_POR_ENTRAR))
}

const contarAlmacen = (planta: Planta) =>
  planta.piezas.filter((p) => p.estado === 'almacen').length

// Letrero, torreta y vigilancia del latido.
function actualizarEstado(gemelo: Gemelo) {
  const { senales: s, valores } = gemelo
  gemelo.latido = vigilarLatido(
    gemelo.latido,
    valores[NODO.latido],
    gemelo.reloj,
  )
  const sinComunicacion =
    (gemelo.modo === 'vivo' && !gemelo.enlace) ||
    sinLatido(gemelo.latido, gemelo.reloj)
  s.vigilaLatido = gemelo.latido.vigilado
  s.estado = estadoCelda(valores, sinComunicacion)
  s.codFalla = valores[NODO.codFalla] ?? 0
  const luces = lucesTorreta(
    valores[NODO.torreta],
    sinComunicacion,
    gemelo.reloj,
  )
  s.torreVerde = luces.verde
  s.torreAmarilla = luces.amarilla
  s.torreRoja = luces.roja
  s.torreGris = luces.gris
}

// Avanza con paso fijo para que la secuencia salga igual sin importar los cuadros por segundo.
export function avanzarGemelo(gemelo: Gemelo, segundos: number) {
  const { senales, planta, plc } = gemelo
  const vivo = gemelo.modo === 'vivo'
  // el reloj sigue al tiempo real aunque los cuadros vayan lentos (la repetición depende
  // de él); la física avanza a lo más 0.1 s por cuadro para no dar saltos
  gemelo.reloj += segundos
  gemelo.acumulado = Math.min(
    gemelo.acumulado + Math.min(segundos, 0.1) * (vivo ? 1 : gemelo.velocidad),
    0.5,
  )
  if (vivo) {
    const antes = gemelo.repeticion.aplicado
    gemelo.valores = valoresEn(gemelo.repeticion, gemelo.reloj)
    const ahora = gemelo.repeticion.aplicado
    if (ahora !== null && ahora !== antes)
      gemelo.retraso = Math.max(0, (Date.now() - ahora) / 1000)
    contarPiezas(gemelo)
  }
  while (gemelo.acumulado >= PASO_FIJO) {
    if (!vivo && gemelo.comunicacion) {
      // sin comunicación el S7-1516 virtual deja de publicar: todo se queda como estaba
      avanzarPlc1516(gemelo.s7, senales, PASO_FIJO)
      gemelo.valores = gemelo.s7.valores
    }
    avanzarActuadores(
      gemelo.actuadores,
      gemelo.valores,
      senales,
      piezaSelladaEnTope(planta),
      PASO_FIJO,
    )
    const enAlmacen = contarAlmacen(planta)
    avanzarPlc(plc, senales, planta.carriles, PASO_FIJO)
    avanzarPlanta(planta, senales, PASO_FIJO)
    // salió una pieza del almacén: si ya se había contado, se lleva ese material
    if (vivo && contarAlmacen(planta) < enAlmacen && gemelo.porEntrar.length) {
      gemelo.porEntrar = gemelo.porEntrar.slice(1)
      pintarAlmacen(planta, gemelo.porEntrar)
    }
    gemelo.acumulado -= PASO_FIJO
  }
  actualizarEstado(gemelo)
}

export function tomarInstantanea(gemelo: Gemelo): Instantanea {
  return {
    ...gemelo.senales,
    empacando: estaEmpacando(gemelo.planta),
    valores: { ...gemelo.valores },
    retraso: gemelo.modo === 'vivo' ? gemelo.retraso : null,
    segundosSinLatido: gemelo.reloj - gemelo.latido.cambio,
  }
}
