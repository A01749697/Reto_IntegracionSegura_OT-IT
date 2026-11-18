// La parte física de la celda: mueve cilindros, carro, piezas y cajas según las salidas del PLC
// y deja en las señales lo que verían los sensores. No dibuja nada.
import {
  alturaCarril,
  BANDA_X0,
  CAJA_X,
  CAJA_Y,
  CAJA_Z,
  CAJAS_POR_TARIMA,
  CARRERA,
  CARRILES,
  PARADAS_CARRO,
  PIEZAS_POR_CAJA,
  RAMPA,
  TOTAL_PIEZAS,
  VELOCIDAD_BANDA,
  X_ALMACEN,
  X_IDENTIFICACION,
  X_MARCADO,
  X_TOMA,
  Y_PIEZA,
  Y_PINZA_ARRIBA,
  Z_BANDA,
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
  caja: number
  destino: P3 // lugar dentro de su caja
  marcada: boolean
}

export type Caja = {
  tipo: Tipo
  piezas: number
  columnas: [number, number]
  estado: 'llenando' | 'cerrando' | 'saliendo' | 'retiro' | 'entra'
  t: number
  avance: number // cuanto ha salido por los rodillos
  escala: number
  cierre: number // 0 = solapas abiertas, 1 = cerradas
}

export type Planta = {
  extension: { A: number; B: number; C: number; Z: number } // 0 = atras, 1 = afuera
  carro: { x: number; pinza: number; lleva: Pieza | null }
  piezas: Pieza[]
  cajas: Caja[]
  tarima: Tipo[] // cajas ya apiladas
  caida: number // la pila del almacen baja suave despues de alimentar
  alimentaba: boolean
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
    columnas: [0, 0],
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
      z: Z_BANDA,
      v: 0,
      vy: 0,
      giro: 0,
      carril: 0,
      caja: -1,
      destino: [0, 0, 0],
      marcada: false,
    })
  }
  return {
    extension: { A: 0, B: 0, C: 0, Z: 0 },
    carro: { x: X_TOMA, pinza: 0, lleva: null },
    piezas,
    cajas: [cajaVacia('pl'), cajaVacia('al')],
    tarima: [],
    caida: 0,
    alimentaba: false,
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
  pieza.tipo = planta.azar() < 0.5 ? 'al' : 'pl'
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
    z: Z_BANDA,
    v: 0,
    vy: 0,
    giro: 0,
  })
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
    pieza.z = Z_BANDA
    if (carro.pinza < 0.5) {
      // la pinza suelta
      carro.lleva = null
      if (Math.abs(pieza.x - X_TOMA) < 0.04) {
        pieza.estado = 'linea'
      } else {
        let cercano = 0
        CARRILES.forEach((x, i) => {
          if (Math.abs(x - pieza.x) < Math.abs(CARRILES[cercano] - pieza.x))
            cercano = i
        })
        pieza.estado = 'carril'
        pieza.carril = cercano
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

export function avanzarPlanta(planta: Planta, s: Senales, dt: number) {
  const { extension, carro } = planta
  extension.A = hacia(extension.A, s.yA ? 1 : 0, dt / 0.45)
  extension.B = hacia(extension.B, s.yB ? 1 : 0, dt / 0.22)
  extension.C = hacia(extension.C, s.yC ? 1 : 0, dt / (s.yC ? 0.2 : 0.3))
  extension.Z = hacia(extension.Z, s.yZ ? 1 : 0, dt / 0.38)
  carro.pinza = hacia(carro.pinza, s.yG ? 1 : 0, dt / 0.15)
  const objetivoX = PARADAS_CARRO[s.posX] ?? X_TOMA
  if (!s.emergencia) carro.x = hacia(carro.x, objetivoX, 0.6 * dt)

  if (s.yA && !planta.alimentaba) sacarDelAlmacen(planta)
  planta.alimentaba = s.yA
  if (extension.A < 0.15) planta.caida = hacia(planta.caida, 0, dt * 7)

  moverPinza(planta)

  const caraAlimentador = -0.7 + extension.A * CARRERA.A
  let sc1 = false
  let si1 = false
  let ls4 = false
  let sc2 = false
  for (const p of planta.piezas) {
    if (p.estado === 'linea') {
      if (p.x - 0.025 < caraAlimentador) p.x = caraAlimentador + 0.025
      if (s.motorBanda && p.x > BANDA_X0 + 0.01)
        p.x = Math.min(X_TOMA + 0.002, p.x + VELOCIDAD_BANDA * dt)
      if (Math.abs(p.x - X_IDENTIFICACION) < 0.03) {
        sc1 = true
        if (p.tipo === 'al') si1 = true
      }
      if (p.x >= X_TOMA - 0.004) ls4 = true
      if (p.x > X_MARCADO - 0.004 && p.x < X_MARCADO + 0.03) sc2 = true
      if (extension.C > 0.97 && Math.abs(p.x - X_MARCADO) < 0.03)
        p.marcada = true
    } else if (p.estado === 'carril') {
      p.v += 2.4 * dt
      p.z += p.v * dt
      p.y = hacia(p.y, alturaCarril(p.z) + 0.027, dt * 0.6)
      p.giro = hacia(p.giro, Math.atan(RAMPA.pendiente), dt * 5)
      if (p.z > RAMPA.z1) {
        const indice = p.carril < 2 ? 0 : 1
        const caja = planta.cajas[indice]
        const columna = p.carril % 2
        const fondo = Math.min(1, caja.columnas[columna]++)
        caja.piezas++
        p.caja = indice
        p.vy = -0.25
        p.estado = 'cae'
        p.destino = [columna ? 0.04 : -0.04, 0.029, fondo ? -0.04 : 0.04]
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

  moverCajas(planta, s, dt)

  // lo que ven los sensores
  s.sc1 = sc1
  s.si1 = si1
  s.ls4 = ls4
  s.sc2 = sc2
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

// el operador retira lo que quedo en la linea
export function despejarLinea(planta: Planta) {
  planta.carro.lleva = null
  for (const p of planta.piezas) {
    if (p.estado === 'linea' || p.estado === 'pinza' || p.estado === 'carril')
      reciclar(planta, p)
  }
  planta.caida = 0
}

export const estaEmpacando = (planta: Planta) =>
  planta.cajas.some((c) => c.estado !== 'llenando')
