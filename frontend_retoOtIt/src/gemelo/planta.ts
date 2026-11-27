// La parte física de la celda: mueve cilindros, carro, piezas y cajas según las salidas de los PLC
// y deja en las señales lo que verían los sensores. No dibuja nada.
// No hay banda: la pieza baja sola por la guía inclinada, se detiene en el tope del marcado
// y, cuando el tope baja, cae al depósito donde la toma la garra.
import {
  ACELERACION_GUIA,
  alturaCarril,
  CAJA_X,
  CAJA_Y,
  CAJA_Z,
  CAJAS_POR_TARIMA,
  CARRERA,
  CARRILES,
  CARRILES_DE,
  GUIA_X0,
  GUIA_X1,
  PARADAS_CARRO,
  PASO_EN_CARRIL,
  PIEZAS_POR_CAJA,
  PIEZAS_POR_CARRIL,
  RAMPA,
  TOTAL_PIEZAS,
  VELOCIDAD_MAXIMA_GUIA,
  X_ALMACEN,
  X_IDENTIFICACION,
  X_MARCADO,
  X_TOMA,
  X_TOPE,
  Y_PIEZA,
  Y_PIEZA_TOMA,
  Y_PINZA_ARRIBA,
  yPiezaEn,
  Z_LINEA,
  type P3,
} from './medidas'
import type { Senales } from './senales'

export type Tipo = 'al' | 'pl'

export type Pieza = {
  tipo: Tipo
  estado: 'almacen' | 'linea' | 'pinza' | 'carril' | 'cae' | 'caja'
  fila: number // lugar en el almacen; 0 es la de abajo
  x: number
  y: number
  z: number
  v: number
  vy: number
  giro: number
  carril: number
  lugar: number // en el carril: 0 es la de hasta abajo
  caja: number
  destino: P3 // lugar dentro de su caja
  marcada: boolean
  sello: Tipo | null // qué sello le puso el marcador (uno distinto por material)
  conocida: boolean // en vivo: ya se sabe su material (si no, se ve gris)
}

export type Caja = {
  tipo: Tipo
  piezas: number
  estado: 'llenando' | 'cerrando' | 'saliendo' | 'retiro' | 'entra'
  t: number
  avance: number // cuanto ha salido por los rodillos
  escala: number
  cierre: number // 0 = solapas abiertas, 1 = cerradas
}

// Un carril de la rampa: las piezas se forman una tras otra contra la compuerta de abajo.
// Cuando hay PIEZAS_POR_CARRIL, la compuerta abre y bajan todas juntas a la caja.
export type Carril = {
  piezas: number
  lleno: number // segundos que lleva lleno y formado
}

export type Planta = {
  // 0 = atras, 1 = afuera. El tope (T) esta afuera, deteniendo piezas, hasta que yT lo baja.
  extension: { A: number; B: number; C: number; Z: number; T: number }
  carro: { x: number; pinza: number; lleva: Pieza | null }
  piezas: Pieza[]
  carriles: Carril[]
  cajas: Caja[]
  tarima: Tipo[] // cajas ya apiladas
  caida: number // la pila del almacen baja suave despues de alimentar
  alimentaba: boolean
  // en vivo el material de una pieza no se sabe hasta que lo cuenta el S7-1516
  enVivo: boolean
  ultimaSacada: Pieza | null // la pieza que está en proceso en los pistones
  azar: () => number
}

const ORDEN_INICIAL: Tipo[] = [
  'al',
  'pl',
  'pl',
  'al',
  'pl',
  'al',
  'al',
  'pl',
  'al',
  'pl',
  'pl',
  'al',
]

export function hacia(valor: number, objetivo: number, paso: number): number {
  return valor < objetivo
    ? Math.min(objetivo, valor + paso)
    : Math.max(objetivo, valor - paso)
}

function cajaVacia(tipo: Tipo): Caja {
  return {
    tipo,
    piezas: 0,
    estado: 'llenando',
    t: 0,
    avance: 0,
    escala: 1,
    cierre: 0,
  }
}

export function crearPlanta(azar: () => number = Math.random): Planta {
  const piezas: Pieza[] = []
  for (let i = 0; i < TOTAL_PIEZAS; i++) {
    piezas.push({
      tipo: ORDEN_INICIAL[i % ORDEN_INICIAL.length],
      estado: 'almacen',
      fila: i,
      x: X_ALMACEN,
      y: 0,
      z: Z_LINEA,
      v: 0,
      vy: 0,
      giro: 0,
      carril: 0,
      lugar: 0,
      caja: -1,
      destino: [0, 0, 0],
      marcada: false,
      sello: null,
      conocida: true,
    })
  }
  return {
    extension: { A: 0, B: 0, C: 0, Z: 0, T: 1 },
    carro: { x: X_TOMA, pinza: 0, lleva: null },
    piezas,
    carriles: CARRILES.map(() => ({ piezas: 0, lleno: 0 })),
    cajas: [cajaVacia('al'), cajaVacia('pl')],
    tarima: [],
    caida: 0,
    alimentaba: false,
    enVivo: false,
    ultimaSacada: null,
    azar,
  }
}

const enAlmacen = (planta: Planta) =>
  planta.piezas.filter((p) => p.estado === 'almacen')

// la pieza vuelve al final de la fila del almacen, con un material al azar
function reciclar(planta: Planta, pieza: Pieza) {
  pieza.estado = 'almacen'
  pieza.fila = Math.max(0, enAlmacen(planta).length - 1)
  pieza.giro = 0
  pieza.caja = -1
  pieza.marcada = false
  pieza.sello = null
  pieza.tipo = planta.azar() < 0.5 ? 'al' : 'pl'
  pieza.conocida = !planta.enVivo
}

// En vivo: las piezas de abajo del almacén toman, en orden, los materiales que el S7-1516
// ya contó; las demás quedan grises porque todavía no se sabe qué son.
// En vivo la garra real puede tomar piezas que el gemelo no vio llegar: se pone una en el
// depósito, tomada de lo alto del almacén (la parte que no se ve de la pila).
export function ponerEnDeposito(planta: Planta, tipo: Tipo) {
  const ocupado = planta.piezas.some(
    (p) => p.estado === 'linea' && p.x > X_TOMA - 0.03,
  )
  const pila = enAlmacen(planta)
  if (ocupado || pila.length === 0) return
  const pieza = pila.reduce((a, b) => (b.fila > a.fila ? b : a))
  Object.assign(pieza, {
    estado: 'linea',
    tipo,
    conocida: true,
    marcada: false,
    sello: null,
    x: X_TOMA,
    y: Y_PIEZA_TOMA,
    z: Z_LINEA,
    v: 0,
    vy: 0,
    giro: 0,
  })
}

export function pintarAlmacen(planta: Planta, tipos: readonly Tipo[]) {
  const fila = enAlmacen(planta).sort((a, b) => a.fila - b.fila)
  fila.forEach((pieza, i) => {
    if (i < tipos.length) {
      pieza.tipo = tipos[i]
      pieza.conocida = true
    } else pieza.conocida = !planta.enVivo
  })
}

// En vivo: llegó el material de la pieza que ya está en proceso.
export function identificarEnLinea(planta: Planta, tipo: Tipo): boolean {
  const pieza = planta.ultimaSacada
  if (!pieza || pieza.conocida || pieza.estado === 'almacen') return false
  pieza.tipo = tipo
  pieza.conocida = true
  return true
}

function sacarDelAlmacen(planta: Planta) {
  const fila = enAlmacen(planta)
  if (fila.length === 0) return
  const pieza = fila.reduce((a, b) => (a.fila < b.fila ? a : b))
  for (const otra of fila) otra.fila--
  Object.assign(pieza, {
    estado: 'linea',
    x: X_ALMACEN,
    y: Y_PIEZA,
    z: Z_LINEA,
    v: 0,
    vy: 0,
    giro: 0,
  })
  planta.ultimaSacada = pieza
  planta.caida = 1
}

export const alturaPinza = (planta: Planta) =>
  Y_PINZA_ARRIBA - planta.extension.Z * CARRERA.Z

function moverPinza(planta: Planta) {
  const { carro } = planta
  const altura = alturaPinza(planta)
  if (carro.lleva) {
    const pieza = carro.lleva
    pieza.x = carro.x
    pieza.y = altura
    pieza.z = Z_LINEA
    if (carro.pinza < 0.5) {
      // la pinza suelta
      carro.lleva = null
      if (Math.abs(pieza.x - X_TOMA) < 0.04) {
        pieza.estado = 'linea'
        pieza.v = 0
        pieza.vy = 0
      } else {
        let cercano = 0
        CARRILES.forEach((x, i) => {
          if (Math.abs(x - pieza.x) < Math.abs(CARRILES[cercano] - pieza.x))
            cercano = i
        })
        pieza.estado = 'carril'
        pieza.carril = cercano
        pieza.lugar = planta.carriles[cercano].piezas++
        pieza.x = CARRILES[cercano]
        pieza.v = 0.12
      }
    }
  } else if (carro.pinza > 0.9) {
    const pieza = planta.piezas.find(
      (p) =>
        p.estado === 'linea' &&
        Math.abs(p.x - carro.x) < 0.02 &&
        Math.abs(p.y - altura) < 0.02,
    )
    if (pieza) {
      pieza.estado = 'pinza'
      carro.lleva = pieza
    }
  }
}

// La caja de cada material queda bajo sus dos carriles.
const cajaDelCarril = (carril: number) =>
  (CARRILES_DE.al as readonly number[]).includes(carril) ? 0 : 1

// Un carril lleno espera un momento formado y, si su caja está vacía y lista, abre la
// compuerta: sus piezas bajan juntas a la caja, dos al frente y dos atrás.
function moverCarriles(planta: Planta, dt: number) {
  planta.carriles.forEach((carril, indice) => {
    const suyas = planta.piezas.filter(
      (p) => p.estado === 'carril' && p.carril === indice,
    )
    const formado =
      carril.piezas >= PIEZAS_POR_CARRIL &&
      suyas.length >= PIEZAS_POR_CARRIL &&
      suyas.every((p) => p.v === 0)
    carril.lleno = formado ? carril.lleno + dt : 0
    const caja = planta.cajas[cajaDelCarril(indice)]
    if (carril.lleno < 1.2 || caja.estado !== 'llenando' || caja.piezas > 0)
      return
    for (const p of suyas) {
      p.caja = cajaDelCarril(indice)
      p.vy = -0.25
      p.estado = 'cae'
      p.destino = [
        p.lugar % 2 ? 0.04 : -0.04,
        0.029,
        p.lugar < 2 ? 0.04 : -0.04,
      ]
    }
    caja.piezas += suyas.length
    carril.piezas = 0
    carril.lleno = 0
  })
}

// cajas: llenar, cerrar las solapas, salir por los rodillos y pasar a la tarima
function moverCajas(planta: Planta, s: Senales, dt: number) {
  planta.cajas.forEach((caja, indice) => {
    caja.t += dt
    const suyas = planta.piezas.filter((p) => p.caja === indice)
    if (caja.estado === 'llenando') {
      if (
        caja.piezas >= PIEZAS_POR_CAJA &&
        suyas.every((p) => p.estado === 'caja')
      ) {
        caja.estado = 'cerrando'
        caja.t = 0
      }
    } else if (caja.estado === 'cerrando') {
      caja.cierre = Math.min(1, caja.t / 0.6)
      if (caja.t > 0.75) {
        caja.estado = 'saliendo'
        caja.t = 0
      }
    } else if (caja.estado === 'saliendo') {
      caja.avance = Math.min(0.155, caja.avance + 0.2 * dt)
      if (caja.avance >= 0.155 && caja.t > 1.1) {
        caja.estado = 'retiro'
        caja.t = 0
      }
    } else if (caja.estado === 'retiro') {
      caja.escala = Math.max(0, 1 - caja.t / 0.25)
      if (caja.t > 0.3) {
        // el montacargas se lleva la tarima cuando se llena
        if (planta.tarima.length >= CAJAS_POR_TARIMA) planta.tarima = []
        planta.tarima.push(caja.tipo)
        if (caja.tipo === 'al') s.cajasAl++
        else s.cajasPl++
        suyas.forEach((p) => reciclar(planta, p))
        Object.assign(caja, cajaVacia(caja.tipo), {
          estado: 'entra',
          escala: 0,
        })
      }
    } else {
      caja.escala = Math.min(1, caja.t / 0.25)
      if (caja.t > 0.3) {
        caja.escala = 1
        caja.estado = 'llenando'
      }
    }
  })
}

// Una pieza suelta en la linea: en la parte plana solo se mueve si la empuja el alimentador;
// en la pendiente baja sola hasta el tope o, si el tope esta abajo, hasta caer al deposito.
function moverEnLinea(
  p: Pieza,
  caraAlimentador: number,
  topeArriba: boolean,
  sujeta: boolean,
  dt: number,
) {
  if (p.x - 0.025 < caraAlimentador) p.x = caraAlimentador + 0.025

  if (p.x < GUIA_X1 + 0.02) {
    // sobre la guia
    const enMarcado = Math.abs(p.x - X_MARCADO) < 0.03
    if (p.x <= GUIA_X0 + 0.005 || (sujeta && enMarcado)) p.v = 0
    else p.v = Math.min(VELOCIDAD_MAXIMA_GUIA, p.v + ACELERACION_GUIA * dt)
    p.x += p.v * dt
    const frente = X_TOPE - 0.029 // donde queda la pieza recargada en el tope
    // solo detiene a la pieza que llega; la que ya paso por encima sigue su camino
    if (topeArriba && p.x > frente && p.x < frente + 0.012) {
      p.x = frente
      p.v = 0
    }
    p.y = yPiezaEn(p.x)
    p.vy = 0
    return
  }

  // cae al deposito; el fondo tiene una ligera pendiente y la pieza resbala
  // hasta recargarse en la pared, justo debajo de la garra
  p.vy -= 5 * dt
  p.y = Math.max(Y_PIEZA_TOMA, p.y + p.vy * dt)
  if (p.y <= Y_PIEZA_TOMA) {
    p.vy = 0
    p.v = Math.max(p.v * 0.98, 0.08)
  }
  p.x = Math.min(X_TOMA, p.x + p.v * dt)
  if (p.x >= X_TOMA) p.v = 0
}

export function avanzarPlanta(planta: Planta, s: Senales, dt: number) {
  const { extension, carro } = planta
  extension.A = hacia(extension.A, s.yA ? 1 : 0, dt / 0.45)
  extension.B = hacia(extension.B, s.yB ? 1 : 0, dt / 0.22)
  extension.C = hacia(extension.C, s.yC ? 1 : 0, dt / (s.yC ? 0.2 : 0.3))
  extension.Z = hacia(extension.Z, s.yZ ? 1 : 0, dt / 0.38)
  extension.T = hacia(extension.T, s.yT ? 0 : 1, dt / 0.12)
  carro.pinza = hacia(carro.pinza, s.yG ? 1 : 0, dt / 0.15)
  const objetivoX = PARADAS_CARRO[s.posX] ?? X_TOMA
  carro.x = hacia(carro.x, objetivoX, 0.6 * dt)

  if (s.yA && !planta.alimentaba) sacarDelAlmacen(planta)
  planta.alimentaba = s.yA
  if (extension.A < 0.15) planta.caida = hacia(planta.caida, 0, dt * 7)

  moverPinza(planta)

  const caraAlimentador = -0.7 + extension.A * CARRERA.A
  const topeArriba = extension.T > 0.5
  const sujeta = extension.B > 0.5
  let sc1 = false
  let si1 = false
  let sc2 = false
  let ls4 = false
  let si3 = false
  for (const p of planta.piezas) {
    if (p.estado === 'linea') {
      moverEnLinea(p, caraAlimentador, topeArriba, sujeta, dt)
      if (Math.abs(p.x - X_IDENTIFICACION) < 0.03) {
        sc1 = true
        if (p.tipo === 'al') si1 = true
      }
      if (p.x > X_MARCADO - 0.004 && p.x < X_MARCADO + 0.03) sc2 = true
      if (
        !p.marcada &&
        extension.C > 0.97 &&
        Math.abs(p.x - X_MARCADO) < 0.03
      ) {
        p.marcada = true
        p.sello = s.material || p.tipo
      }
      // LS-4 y SI-3 son de la garra: miran el deposito
      if (p.x >= X_TOMA - 0.004 && p.y <= Y_PIEZA_TOMA + 0.002) {
        ls4 = true
        if (p.tipo === 'al') si3 = true
      }
    } else if (p.estado === 'carril') {
      p.v += 2.4 * dt
      p.z += p.v * dt
      p.y = hacia(p.y, alturaCarril(p.z) + 0.027, dt * 0.6)
      p.giro = hacia(p.giro, Math.atan(RAMPA.pendiente), dt * 5)
      // se detiene formada detrás de las que ya están en el carril
      const alto = RAMPA.z1 - 0.03 - p.lugar * PASO_EN_CARRIL
      if (p.z >= alto) {
        p.z = alto
        p.v = 0
      }
    } else if (p.estado === 'cae') {
      const caja = planta.cajas[p.caja]
      const ox = CAJA_X[p.caja] + p.destino[0]
      const oy = CAJA_Y + p.destino[1]
      const oz = CAJA_Z + caja.avance + p.destino[2]
      p.vy -= 5 * dt
      p.y = Math.max(oy, p.y + p.vy * dt)
      p.x = hacia(p.x, ox, dt * 0.3)
      p.z = hacia(p.z, oz, dt * 0.8)
      p.giro = hacia(p.giro, 0, dt * 6)
      if (p.y <= oy && Math.abs(p.z - oz) < 0.002) p.estado = 'caja'
    }
  }

  moverCarriles(planta, dt)
  moverCajas(planta, s, dt)

  // lo que ven los sensores
  s.sc1 = sc1
  s.si1 = si1
  s.sc2 = sc2
  s.ls4 = ls4
  s.si3 = si3
  s.ls1 = extension.A < 0.02
  s.ls2 = extension.A > 0.98
  s.b0 = extension.B < 0.02
  s.ls3 = extension.B > 0.98
  s.c1 = extension.C > 0.98
  s.z0 = extension.Z < 0.02
  s.z1 = extension.Z > 0.98
  s.si2 = Math.abs(carro.x - X_TOMA) < 0.002
  s.xOk = Math.abs(carro.x - objetivoX) < 0.0005
  s.posMm = (carro.x - X_TOMA) * 1000
  const enMovimiento =
    Object.values(extension).some((e) => e > 0.02 && e < 0.98) || !s.xOk
  s.presion += ((enMovimiento ? 5.72 : 6) - s.presion) * Math.min(1, dt * 6)
}

// el operador retira lo que quedo en la linea y en el deposito
export function despejarLinea(planta: Planta) {
  planta.carro.lleva = null
  planta.ultimaSacada = null
  for (const p of planta.piezas) {
    if (p.estado === 'linea' || p.estado === 'pinza' || p.estado === 'carril')
      reciclar(planta, p)
  }
  for (const carril of planta.carriles)
    Object.assign(carril, { piezas: 0, lleno: 0 })
  planta.caida = 0
  planta.extension.T = 1
}

export const estaEmpacando = (planta: Planta) =>
  planta.cajas.some((c) => c.estado !== 'llenando')
