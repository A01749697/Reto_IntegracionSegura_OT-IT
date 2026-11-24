// La máquina: bancada, guía, depósito, cilindros, almacén, sensores, pórtico, rampa, empaque y piezas.
// Recorrido de una pieza: alimentador, guía inclinada (baja sola), identificación, tope del marcado,
// caída al depósito, garra del pórtico, carril y caja.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import {
  alta,
  basico,
  caja,
  cajaR,
  cil,
  estandar,
  led,
  letrero,
  manguera,
  textura,
  type Led,
  type Materiales,
} from './materiales'
import {
  alturaCarril,
  CAJA_X,
  CAJAS_POR_TARIMA,
  CARRERA,
  GUIA_X0,
  GUIA_X1,
  PARADAS_CARRO,
  PENDIENTE_GUIA,
  RAMPA,
  TOTAL_PIEZAS,
  X_ALMACEN,
  X_IDENTIFICACION,
  X_MARCADO,
  X_TOMA,
  X_TOPE,
  Y_DEPOSITO,
  Y_GUIA,
  Y_PIEZA,
  Y_PIEZA_TOMA,
  yGuia,
  yPiezaEn,
  Z_LINEA,
  Z_PORTICO,
} from './medidas'
import type { Tipo } from './planta'

type Grupo = THREE.Group

export type Piston = {
  grupo: Grupo
  vastago: Grupo
  carrera: number
  leds: [Led | null, Led | null] // detectores magneticos: [atras, afuera]
  puertos: THREE.Vector3[]
  dedos: { dedo: Grupo; lado: number }[]
}

export type SensorCelda =
  'sc1' | 'si1' | 'sc2' | 'si2' | 'si3' | 'ls1' | 'ls2' | 'ls3' | 'ls4'

// Las estaciones quedaron mas altas que con la banda (la guia baja hacia el deposito).
// Esto es cuanto subio cada una respecto a la altura de la banda anterior.
const ALTURA_BANDA_ANTERIOR = 0.2
const subida = (x: number) => yGuia(x) - ALTURA_BANDA_ANTERIOR

// viga del portico y canal de la cadena portacables
const Z_VIGA = Z_PORTICO + 0.065
export const CADENA = {
  x0: 0.3,
  y0: 0.452,
  radio: 0.029,
  largo: 0.66,
  z: Z_VIGA,
}

// Placa de acero sobre una base soldada y anclada al piso.
function bancada(E: Grupo, m: Materiales) {
  const base = estandar(0x34424f, { roughness: 0.55, metalness: 0.35 })
  const puerta = estandar(0x41515f, { roughness: 0.5, metalness: 0.35 })
  const oscuro = estandar(0x1b2026, { roughness: 0.8 })
  caja(
    2,
    0.03,
    0.95,
    estandar(0x8d959c, { roughness: 0.42, metalness: 0.85 }),
    0,
    -0.015,
    0,
    E,
  )
  caja(
    2.02,
    0.035,
    0.97,
    estandar(0x2a333c, { roughness: 0.5, metalness: 0.5 }),
    0,
    -0.047,
    0,
    E,
  )
  cajaR(1.94, 0.64, 0.89, base, 0, -0.385, 0, E, 0.012)
  caja(1.84, 0.075, 0.79, oscuro, 0, -0.742, 0, E)
  for (const x of [-0.85, 0, 0.85]) {
    for (const z of [-0.36, 0.36]) {
      cil(0.035, 0.02, m.acero, x, -0.79, z, 'y', E, 16)
      cil(0.012, 0.03, m.acero, x, -0.775, z, 'y', E, 8)
    }
  }
  // puertas de servicio al frente; la primera lleva rejilla
  for (let i = 0; i < 3; i++) {
    const x = -0.63 + i * 0.63
    caja(0.6, 0.56, 0.006, puerta, x, -0.385, 0.447, E)
    caja(0.012, 0.1, 0.014, m.acero, x + 0.25, -0.36, 0.455, E)
    if (i === 0) {
      for (let k = 0; k < 8; k++)
        caja(0.26, 0.008, 0.004, oscuro, x - 0.1, -0.5 - k * 0.02, 0.451, E)
    }
  }
  const rotulo = letrero(0.3, 0.075, [256, 64], (g) => {
    g.fillStyle = '#e0b21a'
    g.fillRect(0, 0, 256, 64)
    g.fillStyle = '#15181b'
    g.font = '700 26px Arial'
    g.textAlign = 'center'
    g.fillText('CELDA 01', 128, 28)
    g.font = '600 17px Arial'
    g.fillText('CLASIFICADO Y EMPAQUE', 128, 52)
  })
  rotulo.position.set(0, -0.14, 0.4515)
  E.add(rotulo)
  // canto de seguridad y cubrecables hacia el gabinete
  for (const x of [-1, 1]) caja(0.012, 0.03, 0.95, m.amarillo, x, -0.015, 0, E)
  caja(0.9, 0.06, 0.1, estandar(0xe0b21a), -0.9, -0.77, -0.75, E).rotation.y =
    0.6
}

// Guia por gravedad: plana bajo el almacen y luego inclinada hasta el deposito.
function guia(E: Grupo, m: Materiales) {
  const ancho = 0.07
  // tramo plano, bajo el almacen y el alimentador
  const xPlano = -0.8
  caja(
    GUIA_X0 - xPlano,
    0.004,
    ancho,
    m.alu,
    (xPlano + GUIA_X0) / 2,
    Y_GUIA - 0.002,
    Z_LINEA,
    E,
  )

  // tramo inclinado, con dos bordes bajos para que la pieza no se salga
  const recorrido = GUIA_X1 - GUIA_X0
  const largo = Math.hypot(recorrido, recorrido * PENDIENTE_GUIA)
  const inclinada = new THREE.Group()
  inclinada.position.set(
    (GUIA_X0 + GUIA_X1) / 2,
    (yGuia(GUIA_X0) + yGuia(GUIA_X1)) / 2 - 0.002,
    Z_LINEA,
  )
  inclinada.rotation.z = -Math.atan(PENDIENTE_GUIA)
  E.add(inclinada)
  caja(largo, 0.004, ancho, m.alu, 0, 0, 0, inclinada)
  caja(largo, 0.008, 0.06, m.aluOsc, 0, -0.008, 0, inclinada)
  for (const lado of [-1, 1])
    caja(
      largo,
      0.012,
      0.004,
      m.aluOsc,
      0,
      0.006,
      lado * (ancho / 2 + 0.002),
      inclinada,
    )

  // patas
  for (const x of [-0.45, -0.15, 0.2]) {
    const alto = yGuia(x) - 0.012
    caja(0.025, alto, 0.025, m.perfilV, x, alto / 2, Z_LINEA - 0.05, E)
    caja(0.05, 0.006, 0.05, m.aluOsc, x, 0.003, Z_LINEA - 0.05, E)
    caja(0.025, 0.012, 0.06, m.aluOsc, x, alto - 0.004, Z_LINEA - 0.025, E)
  }
}

// Deposito al final de la guia: la pieza cae aqui y la garra la toma desde arriba.
function deposito(E: Grupo, m: Materiales) {
  const fondo = Y_DEPOSITO
  const pared = 0.07
  // fondo y columna que lo sostiene
  caja(0.09, 0.006, 0.08, m.aluOsc, X_TOMA - 0.01, fondo - 0.003, Z_LINEA, E)
  caja(
    0.04,
    fondo - 0.006,
    0.04,
    m.perfilV,
    X_TOMA,
    (fondo - 0.006) / 2,
    Z_LINEA,
    E,
  )
  caja(0.08, 0.006, 0.08, m.aluOsc, X_TOMA, 0.003, Z_LINEA, E)
  // pared del fondo, donde se recarga la pieza
  caja(
    0.006,
    pared,
    0.08,
    m.rojo,
    X_TOMA + 0.031,
    fondo + pared / 2,
    Z_LINEA,
    E,
  )
  // paredes de los lados: van desde el final de la guia hasta el fondo
  const desde = GUIA_X1 - 0.005
  const hasta = X_TOMA + 0.034
  for (const lado of [-1, 1])
    caja(
      hasta - desde,
      pared,
      0.004,
      m.alu,
      (desde + hasta) / 2,
      fondo + pared / 2,
      Z_LINEA + lado * 0.037,
      E,
    )
  // labio de entrada al final de la guia
  const alto = yGuia(GUIA_X1) - fondo
  caja(
    0.012,
    alto,
    0.07,
    m.aluOsc,
    GUIA_X1 - 0.004,
    fondo + alto / 2 - 0.004,
    Z_LINEA,
    E,
  )
}

type OpcionesPiston = {
  carrera: number
  diametro?: number
  salida?: number
  punta?: 'empuje' | 'pinza' | 'sello'
  redondo?: boolean
  simple?: boolean // de simple efecto: regresa por resorte
  detectores?: number
}

// Cilindro neumatico. El vastago sale hacia +x.
function crearPiston(m: Materiales, opciones: OpcionesPiston): Piston {
  const {
    carrera,
    diametro = 0.034,
    salida = 0.04,
    punta = 'empuje',
    redondo = false,
    simple = false,
    detectores = 2,
  } = opciones
  const g = new THREE.Group()
  const tapa = 0.02
  const lado = diametro + 0.014
  const largo = carrera + 0.03
  const xTrasera = -tapa - largo - tapa / 2

  if (redondo) {
    // cuerpo redondo de inoxidable sobre soportes azul oscuro
    cajaR(tapa, lado - 0.008, lado - 0.008, m.alu, -tapa / 2, 0, 0, g, 0.003)
    cil(diametro / 2, largo, m.inox, -tapa - largo / 2, 0, 0, 'x', g, 32)
    cajaR(tapa, lado - 0.008, lado - 0.008, m.alu, xTrasera, 0, 0, g, 0.003)
    for (const x of [-0.005, xTrasera - 0.005])
      cajaR(0.01, lado + 0.012, lado + 0.02, m.azulOsc, x, -0.003, 0, g, 0.003)
  } else {
    // cilindro de tirantes
    cajaR(tapa, lado, lado, m.aluOsc, -tapa / 2, 0, 0, g, 0.003)
    cil(diametro / 2, largo, m.alu, -tapa - largo / 2, 0, 0, 'x', g, 32)
    cajaR(tapa, lado, lado, m.aluOsc, xTrasera, 0, 0, g, 0.003)
    const o = lado / 2 - 0.005
    for (const [y, z] of [
      [o, o],
      [o, -o],
      [-o, o],
      [-o, -o],
    ]) {
      cil(
        0.0022,
        largo + 2 * tapa + 0.008,
        m.acero,
        -tapa - largo / 2,
        y,
        z,
        'x',
        g,
        8,
      )
      cil(0.004, 0.004, m.acero, 0.002, y, z, 'x', g, 6)
    }
  }
  cil(0.011, 0.008, m.acero, 0.004, 0, 0, 'x', g, 16)

  const vastago = new THREE.Group()
  g.add(vastago)
  const grosor = 0.012
  const dedos: Piston['dedos'] = []
  cil(
    0.0065,
    carrera + 0.02 + salida - grosor,
    m.cromo,
    (salida - grosor - carrera - 0.02) / 2,
    0,
    0,
    'x',
    vastago,
    16,
  )
  cil(0.01, 0.008, m.acero, salida - grosor - 0.004, 0, 0, 'x', vastago, 6)
  if (punta === 'pinza') {
    // pinza paralela de dos dedos; el centro de la pieza queda en salida + 0.05
    cajaR(0.024, 0.04, 0.085, m.negro, salida + 0.01, 0, 0, vastago, 0.004)
    caja(0.01, 0.03, 0.05, m.acero, salida - 0.004, 0, 0, vastago)
    for (const s of [-1, 1]) {
      const dedo = new THREE.Group()
      vastago.add(dedo)
      caja(0.052, 0.028, 0.007, m.acero, salida + 0.046, 0, 0, dedo)
      caja(0.02, 0.03, 0.003, m.goma, salida + 0.058, 0, -s * 0.005, dedo)
      dedos.push({ dedo, lado: s })
    }
  } else if (punta === 'sello') {
    // punzon de marcado
    cil(0.016, 0.03, m.alu, salida - 0.027, 0, 0, 'x', vastago, 24)
    cil(0.012, grosor, m.acero, salida - grosor / 2, 0, 0, 'x', vastago, 24)
  } else {
    cajaR(
      grosor,
      0.046,
      0.05,
      m.azul,
      salida - grosor / 2,
      0,
      0,
      vastago,
      0.003,
    )
  }

  const leds: Piston['leds'] = [null, null]
  ;[-tapa - largo + 0.022, -tapa - 0.022].forEach((x, i) => {
    if (detectores === 0 || (detectores === 1 && i === 0)) return
    cajaR(0.026, 0.012, 0.016, m.negro, x, diametro / 2 + 0.005, 0, g, 0.002)
    const foco = led(0xffb020)
    caja(0.006, 0.003, 0.006, foco, x, diametro / 2 + 0.012, 0, g)
    leds[i] = foco
  })

  const puertos: THREE.Vector3[] = []
  for (const x of simple ? [xTrasera] : [xTrasera, -tapa / 2]) {
    cil(0.005, 0.012, m.laton, x, lado / 2 + 0.002, 0, 'y', g, 12)
    cil(0.0068, 0.007, m.azul, x, lado / 2 + 0.01, 0, 'y', g, 12)
    puertos.push(new THREE.Vector3(x, lado / 2 + 0.013, 0))
  }
  // silenciador de escape
  if (simple)
    cil(0.004, 0.012, m.laton, -tapa / 2, lado / 2 + 0.002, 0, 'y', g, 10)
  return { grupo: g, vastago, carrera, leds, puertos, dedos }
}

function pistones(E: Grupo, m: Materiales) {
  const A = crearPiston(m, {
    carrera: CARRERA.A,
    redondo: true,
    detectores: 0,
  })
  const B = crearPiston(m, { carrera: CARRERA.B, salida: 0.03, redondo: true })
  const C = crearPiston(m, {
    carrera: CARRERA.C,
    salida: 0.085,
    redondo: true,
    simple: true,
    detectores: 1,
    punta: 'sello',
  })
  const Z = crearPiston(m, {
    carrera: CARRERA.Z,
    salida: 0.05,
    punta: 'pinza',
    diametro: 0.036,
  })
  // tope del marcado: sale hacia arriba por la guia y detiene la pieza
  const T = crearPiston(m, {
    carrera: CARRERA.T,
    salida: 0.02,
    diametro: 0.022,
    redondo: true,
    detectores: 0,
  })

  // PD-1 alimentador, con la leva que acciona LS-1 y LS-2
  A.grupo.position.set(-0.74, Y_PIEZA, Z_LINEA)
  E.add(A.grupo)
  caja(0.008, 0.008, 0.045, m.acero, 0.034, 0, 0.04, A.vastago)
  const altoSoporte = Y_PIEZA - 0.03
  for (const x of [-0.75, -0.945])
    caja(0.02, altoSoporte, 0.05, m.aluOsc, x, altoSoporte / 2, Z_LINEA, E)

  // PD-2 sujecion
  const yMarcado = yPiezaEn(X_MARCADO)
  const dM = subida(X_MARCADO)
  const altoMarcado = yMarcado - 0.03
  B.grupo.position.set(X_MARCADO, yMarcado, Z_LINEA - 0.105)
  B.grupo.rotation.y = -Math.PI / 2
  E.add(B.grupo)
  for (const z of [Z_LINEA - 0.115, Z_LINEA - 0.205])
    caja(0.05, altoMarcado, 0.02, m.aluOsc, X_MARCADO, altoMarcado / 2, z, E)

  // tope: el vastago sale hacia +y; afuera queda 3 cm sobre la guia
  T.grupo.position.set(X_TOPE + 0.019, yGuia(X_TOPE) - 0.025, Z_LINEA)
  T.grupo.rotation.z = Math.PI / 2
  E.add(T.grupo)

  // PS marcador, con su bastidor y la mordaza fija
  C.grupo.position.set(X_MARCADO, 0.415 + dM, Z_LINEA)
  C.grupo.rotation.z = -Math.PI / 2
  E.add(C.grupo)
  for (const lado of [-1, 1]) {
    const x = X_MARCADO + lado * 0.075
    caja(
      0.03,
      0.415 + dM,
      0.03,
      m.perfilV,
      x,
      (0.415 + dM) / 2,
      Z_LINEA - 0.16,
      E,
    )
    caja(0.06, 0.006, 0.05, m.aluOsc, x, 0.003, Z_LINEA - 0.16, E)
  }
  caja(0.18, 0.03, 0.03, m.perfil, X_MARCADO, 0.4 + dM, Z_LINEA - 0.16, E)
  caja(0.06, 0.03, 0.21, m.perfil, X_MARCADO, 0.4 + dM, Z_LINEA - 0.045, E)
  caja(0.064, 0.042, 0.012, m.acero, X_MARCADO, yMarcado, Z_LINEA + 0.033, E)
  caja(
    0.064,
    0.006,
    0.05,
    m.aluOsc,
    X_MARCADO,
    yGuia(X_MARCADO) + 0.004,
    Z_LINEA + 0.058,
    E,
  )
  caja(
    0.012,
    0.03,
    0.012,
    m.aluOsc,
    X_MARCADO,
    yGuia(X_MARCADO) + 0.015,
    Z_LINEA + 0.045,
    E,
  )

  return { A, B, C, Z, T }
}

// Almacen de piezas por gravedad.
function almacen(E: Grupo, m: Materiales) {
  caja(0.225, 0.008, 0.09, m.alu, -0.6925, Y_GUIA - 0.004, Z_LINEA, E)
  for (const x of [-0.78, -0.62])
    caja(
      0.02,
      Y_GUIA - 0.008,
      0.06,
      m.aluOsc,
      x,
      (Y_GUIA - 0.008) / 2,
      Z_LINEA,
      E,
    )
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      caja(
        0.008,
        0.33,
        0.008,
        m.alu,
        X_ALMACEN + sx * 0.031,
        Y_GUIA + 0.055 + 0.165,
        Z_LINEA + sz * 0.031,
        E,
      )
    }
  }
  for (const y of [0.06, 0.22, 0.38]) {
    for (const s of [-1, 1]) {
      caja(
        0.07,
        0.008,
        0.004,
        m.aluOsc,
        X_ALMACEN,
        Y_GUIA + y,
        Z_LINEA + s * 0.036,
        E,
      )
      caja(
        0.004,
        0.008,
        0.07,
        m.aluOsc,
        X_ALMACEN + s * 0.036,
        Y_GUIA + y,
        Z_LINEA,
        E,
      )
    }
  }
  for (const sz of [-1, 1])
    caja(
      0.06,
      0.07,
      0.006,
      m.aluOsc,
      X_ALMACEN,
      Y_GUIA + 0.035,
      Z_LINEA + sz * 0.04,
      E,
    )
  caja(
    0.02,
    Y_GUIA + 0.37,
    0.02,
    m.perfilV,
    X_ALMACEN,
    (Y_GUIA + 0.37) / 2,
    Z_LINEA - 0.06,
    E,
  )
}

// Dos capacitivos, dos inductivos y cuatro finales de carrera. Devuelve el foco de cada uno.
function sensores(E: Grupo, m: Materiales): Record<SensorCelda, Led> {
  // final de carrera: caja con palanca y rodillo
  const finalCarrera = (
    x: number,
    y: number,
    z: number,
    giro: number,
    arriba = false,
  ) => {
    const g = new THREE.Group()
    g.position.set(x, y, z)
    g.rotation.y = giro
    E.add(g)
    const s = arriba ? -1 : 1
    cajaR(0.028, 0.045, 0.022, m.azulOsc, 0, -s * 0.03, 0, g, 0.003)
    caja(0.004, 0.026, 0.004, m.acero, 0, -s * 0.001, 0.007, g).rotation.x =
      s * 0.5
    cil(0.006, 0.006, m.acero, 0, s * 0.01, 0.014, 'x', g, 12)
    const foco = led(0x3fd07a)
    caja(0.008, 0.005, 0.003, foco, 0, -s * 0.042, 0.0115, g)
    if (arriba) caja(0.028, 0.006, 0.04, m.aluOsc, 0, 0.056, -0.012, g)
    else
      caja(
        0.014,
        y - 0.05,
        0.004,
        m.aluOsc,
        0,
        -0.05 - (y - 0.05) / 2,
        -0.013,
        g,
      )
    return foco
  }

  // identificacion: SC-1 mira hacia abajo y SI-1 mira de lado
  const xi = X_IDENTIFICACION
  const dI = subida(xi)
  const yI = yPiezaEn(xi)
  for (const sz of [-1, 1]) {
    caja(
      0.03,
      0.41 + dI,
      0.03,
      m.perfilV,
      xi,
      0.205 + dI / 2,
      Z_LINEA + sz * 0.115,
      E,
    )
    caja(0.06, 0.006, 0.05, m.aluOsc, xi, 0.003, Z_LINEA + sz * 0.115, E)
  }
  caja(0.03, 0.03, 0.26, m.perfil, xi, 0.395 + dI, Z_LINEA, E)
  cil(0.009, 0.075, m.azulSensor, xi, 0.325 + dI, Z_LINEA, 'y', E, 20)
  cil(0.013, 0.006, m.negro, xi, 0.365 + dI, Z_LINEA, 'y', E, 6)
  cil(0.013, 0.006, m.negro, xi, 0.376 + dI, Z_LINEA, 'y', E, 6)
  const sc1 = led(0xffb020)
  cil(0.0095, 0.005, sc1, xi, 0.3 + dI, Z_LINEA, 'y', E, 20)
  manguera(
    [
      [xi, 0.41 + dI, Z_LINEA],
      [xi - 0.02, 0.43 + dI, Z_LINEA - 0.06],
      [xi - 0.01, 0.4 + dI, Z_LINEA - 0.13],
      [xi, 0.1, Z_LINEA - 0.14],
      [-0.3, 0.04, -0.43],
    ],
    0.0025,
    m.cable,
    E,
  )
  const zs = Z_LINEA - 0.075
  cil(0.006, 0.055, m.cromo, xi, yI, zs - 0.012, 'z', E, 16)
  cil(0.0062, 0.006, m.naranja, xi, yI, zs + 0.017, 'z', E, 16)
  cil(0.009, 0.005, m.acero, xi, yI, zs - 0.004, 'z', E, 6)
  cil(0.009, 0.005, m.acero, xi, yI, zs - 0.018, 'z', E, 6)
  caja(0.05, 0.05, 0.004, m.aluOsc, xi + 0.012, yI, zs - 0.011, E)
  const si1 = led(0xffb020)
  cil(0.0065, 0.004, si1, xi, yI, zs - 0.041, 'z', E, 12)

  // SC-2: pieza en la estacion de marcado, visto desde el frente
  const xs = X_MARCADO - 0.05
  cil(
    0.009,
    0.065,
    m.azulSensor,
    xs,
    yPiezaEn(X_MARCADO),
    Z_LINEA + 0.09,
    'z',
    E,
    20,
  )
  cil(
    0.013,
    0.006,
    m.negro,
    xs,
    yPiezaEn(X_MARCADO),
    Z_LINEA + 0.085,
    'z',
    E,
    6,
  )
  cil(0.013, 0.006, m.negro, xs, yPiezaEn(X_MARCADO), Z_LINEA + 0.1, 'z', E, 6)
  caja(
    0.034,
    0.05,
    0.004,
    m.aluOsc,
    xs,
    yPiezaEn(X_MARCADO) - 0.008,
    Z_LINEA + 0.0925,
    E,
  )
  const sc2 = led(0xffb020)
  cil(0.0095, 0.005, sc2, xs, yPiezaEn(X_MARCADO), Z_LINEA + 0.125, 'z', E, 20)

  // SI-2: carro del portico en posicion de toma
  cil(0.006, 0.05, m.cromo, X_TOMA - 0.075, 0.612, Z_VIGA, 'x', E, 16)
  cil(0.0062, 0.006, m.naranja, X_TOMA - 0.047, 0.612, Z_VIGA, 'x', E, 16)
  caja(0.012, 0.012, 0.03, m.aluOsc, X_TOMA - 0.08, 0.603, Z_VIGA, E)
  const si2 = led(0xffb020)
  cil(0.0065, 0.004, si2, X_TOMA - 0.102, 0.612, Z_VIGA, 'x', E, 12)

  // SI-3: sensor de metal de la garra, en la pared del deposito
  const zd = Z_LINEA + 0.075
  cil(0.006, 0.055, m.cromo, X_TOMA, Y_PIEZA_TOMA, zd + 0.012, 'z', E, 16)
  cil(0.0062, 0.006, m.naranja, X_TOMA, Y_PIEZA_TOMA, zd - 0.017, 'z', E, 16)
  cil(0.009, 0.005, m.acero, X_TOMA, Y_PIEZA_TOMA, zd + 0.004, 'z', E, 6)
  caja(0.05, 0.05, 0.004, m.aluOsc, X_TOMA - 0.012, Y_PIEZA_TOMA, zd + 0.011, E)
  const si3 = led(0xffb020)
  cil(0.0065, 0.004, si3, X_TOMA, Y_PIEZA_TOMA, zd + 0.041, 'z', E, 12)

  const yLs = Y_PIEZA - 0.02
  return {
    sc1,
    si1,
    sc2,
    si2,
    si3,
    ls1: finalCarrera(-0.706, yLs, Z_LINEA + 0.058, Math.PI), // alimentador atras
    ls2: finalCarrera(-0.541, yLs, Z_LINEA + 0.058, Math.PI), // alimentador adelante
    ls3: finalCarrera(
      X_MARCADO + 0.045,
      yPiezaEn(X_MARCADO) - 0.02,
      Z_LINEA - 0.092,
      -Math.PI / 2,
    ), // pieza sujeta
    ls4: finalCarrera(
      X_TOMA + 0.06,
      Y_PIEZA_TOMA + 0.02,
      Z_LINEA,
      -Math.PI / 2,
      true,
    ), // pieza en el deposito
  }
}

// Portico: viga con el eje X, carro, eje Z neumatico y pinza.
function portico(E: Grupo, m: Materiales, ejeZ: Piston) {
  for (const x of [0.26, 0.93]) {
    caja(0.06, 0.62, 0.06, m.perfilV, x, 0.31, Z_PORTICO, E)
    cajaR(0.064, 0.012, 0.064, m.negro, x, 0.626, Z_PORTICO, E, 0.004)
    caja(0.1, 0.008, 0.1, m.aluOsc, x, 0.004, Z_PORTICO, E)
    for (const s of [-1, 1])
      caja(0.008, 0.05, 0.05, m.aluOsc, x + s * 0.034, 0.03, Z_PORTICO, E)
  }
  caja(0.79, 0.08, 0.07, m.perfil, 0.595, 0.56, Z_VIGA, E)
  for (const x of [0.198, 0.992])
    cajaR(0.006, 0.084, 0.074, m.negro, x, 0.56, Z_VIGA, E, 0.002)
  // guias lineales
  caja(0.72, 0.016, 0.008, m.acero, 0.6, 0.575, Z_VIGA + 0.039, E)
  caja(0.72, 0.016, 0.008, m.acero, 0.6, 0.545, Z_VIGA + 0.039, E)

  // un tope rojo con detector de posicion por cada parada del carro
  const banderas = PARADAS_CARRO.map((x) => {
    cajaR(0.05, 0.02, 0.05, m.rojo, x, 0.61, Z_VIGA, E, 0.004)
    cil(0.006, 0.008, m.negro, x, 0.623, Z_VIGA, 'y', E, 6)
    caja(0.004, 0.026, 0.03, m.negro, x - 0.02, 0.627, Z_VIGA + 0.012, E)
    const foco = led(0xff3b30)
    caja(0.008, 0.004, 0.004, foco, x + 0.012, 0.612, Z_VIGA + 0.026, E)
    return foco
  })

  // cadena portacables y su charola
  caja(0.62, 0.004, 0.045, m.aluOsc, 0.595, CADENA.y0 - 0.012, CADENA.z, E)
  for (const x of [0.29, 0.9])
    caja(0.004, 0.08, 0.045, m.aluOsc, x, 0.48, CADENA.z, E)
  const eslabon = new THREE.BoxGeometry(0.019, 0.011, 0.034)
  const eslabones: THREE.Mesh[] = []
  for (let i = 0; i < 32; i++)
    eslabones.push(alta(new THREE.Mesh(eslabon, m.negro), E, 0, 0, 0))

  const carro = new THREE.Group()
  E.add(carro)
  cajaR(0.1, 0.12, 0.012, m.rojo, 0, 0.56, Z_VIGA + 0.05, carro, 0.004)
  cajaR(0.09, 0.012, 0.085, m.rojo, 0, 0.624, Z_VIGA + 0.012, carro, 0.004)
  for (const y of [0.575, 0.545])
    cajaR(0.06, 0.022, 0.014, m.negro, 0, y, Z_VIGA + 0.041, carro, 0.003)
  const z0 = Z_LINEA - 0.027
  const z1 = Z_VIGA + 0.056
  caja(0.06, 0.05, z0 - z1, m.aluOsc, 0, 0.5, (z0 + z1) / 2, carro)
  caja(0.03, 0.012, 0.11, m.aluOsc, 0, 0.513, Z_VIGA + 0.02, carro) // brazo de la cadena
  for (const [x, y] of [
    [-0.035, 0.6],
    [0.035, 0.6],
    [-0.035, 0.52],
    [0.035, 0.52],
  ])
    cil(0.005, 0.004, m.negro, x, y, Z_VIGA + 0.058, 'z', carro, 6)
  ejeZ.grupo.position.set(0, 0.47, Z_LINEA)
  ejeZ.grupo.rotation.z = -Math.PI / 2
  carro.add(ejeZ.grupo)
  caja(0.012, 0.03, 0.012, m.rojo, 0.034, 0.43, Z_LINEA + 0.03, carro)
  manguera(
    [
      [0, 0.51, Z_VIGA + 0.03],
      [0.02, 0.56, Z_LINEA - 0.05],
      [0.045, 0.67, Z_LINEA - 0.02],
      [0.03, 0.69, Z_LINEA],
    ],
    0.0036,
    m.mangueraAmarilla,
    carro,
  )
  manguera(
    [
      [0, 0.51, Z_VIGA + 0.03],
      [-0.03, 0.5, Z_LINEA - 0.06],
      [-0.045, 0.47, Z_LINEA - 0.03],
      [-0.03, 0.47, Z_LINEA],
    ],
    0.0036,
    m.mangueraAmarilla,
    carro,
  )

  // la cadena hace una U que se recorre con el carro
  function acomodarCadena(xCarro: number) {
    const { x0, y0, radio, largo, z } = CADENA
    const xVuelta = (largo - Math.PI * radio + x0 + xCarro) / 2
    const recta = xVuelta - x0
    const curva = recta + Math.PI * radio
    eslabones.forEach((e, i) => {
      const s = ((i + 0.5) / eslabones.length) * largo
      if (s < recta) {
        e.position.set(x0 + s, y0, z)
        e.rotation.z = 0
      } else if (s < curva) {
        const a = (s - recta) / radio
        e.position.set(
          xVuelta + radio * Math.sin(a),
          y0 + radio - radio * Math.cos(a),
          z,
        )
        e.rotation.z = a
      } else {
        e.position.set(xVuelta - (s - curva), y0 + 2 * radio, z)
        e.rotation.z = Math.PI
      }
    })
  }

  return { carro, banderas, acomodarCadena }
}

// Rampa de cuatro carriles: dos para plastico y dos para aluminio.
function rampa(E: Grupo, m: Materiales) {
  const largo = Math.hypot(0.275, 0.09)
  const angulo = Math.atan(RAMPA.pendiente)
  const g = new THREE.Group()
  g.position.set(0.6875, alturaCarril(0.0125) - 0.002, 0.0125)
  g.rotation.x = angulo
  E.add(g)
  caja(0.35, 0.004, largo, m.alu, 0, 0, 0, g)
  for (let i = 0; i < 5; i++)
    caja(0.009, 0.02, largo, m.rojo, -0.17 + i * 0.085, 0.011, 0, g)
  caja(0.35, 0.02, 0.006, m.rojo, 0, 0.011, -largo / 2, g)
  for (const x of [0.497, 0.878]) {
    caja(0.03, 0.15, 0.03, m.perfilV, x, 0.075, -0.03, E)
    cajaR(0.034, 0.008, 0.034, m.negro, x, 0.154, -0.03, E, 0.003)
    cil(
      0.03,
      0.006,
      m.acero,
      x + (x < 0.6 ? 0.018 : -0.018),
      0.13,
      -0.03,
      'x',
      E,
      24,
    )
    caja(0.06, 0.006, 0.06, m.aluOsc, x, 0.003, -0.03, E)
  }
  const rotulo = (texto: string, x: number) => {
    const placa = letrero(0.15, 0.022, [256, 38], (c) => {
      c.fillStyle = '#10171d'
      c.fillRect(0, 0, 256, 38)
      c.fillStyle = '#e6eef3'
      c.font = '600 24px Arial'
      c.textAlign = 'center'
      c.fillText(texto, 128, 27)
    })
    placa.rotation.x = -Math.PI / 2 + angulo
    placa.position.set(x, alturaCarril(-0.135) + 0.03, -0.14)
    E.add(placa)
  }
  rotulo('PLASTICO', 0.6025)
  rotulo('ALUMINIO', 0.7725)
}

const NOMBRE_TIPO: Record<Tipo, string> = { al: 'ALUMINIO', pl: 'PLASTICO' }
const COLOR_TIPO: Record<Tipo, string> = { al: '#5c6b78', pl: '#1d2126' }
const TIPO_CAJA: Tipo[] = ['pl', 'al'] // en el mismo orden que CAJA_X

// Camas de rodillos con una caja de carton por material.
function cajasEmpaque(E: Grupo, m: Materiales) {
  for (const cx of CAJA_X) {
    for (const s of [-1, 1])
      caja(0.008, 0.032, 0.34, m.aluOsc, cx + s * 0.082, 0.018, 0.305, E)
    for (let i = 0; i < 11; i++)
      cil(0.011, 0.156, m.acero, cx, 0.022, 0.155 + i * 0.03, 'x', E, 14)
  }
  return TIPO_CAJA.map((tipo) => {
    const g = new THREE.Group()
    E.add(g)
    const ancho = 0.16
    const alto = 0.075
    const t = 0.004
    const etiqueta = textura(256, 96, (c) => {
      c.fillStyle = '#b98a56'
      c.fillRect(0, 0, 256, 96)
      c.fillStyle = COLOR_TIPO[tipo]
      c.fillRect(18, 14, 220, 68)
      c.fillStyle = '#fff'
      c.font = '700 34px Arial'
      c.textAlign = 'center'
      c.fillText(NOMBRE_TIPO[tipo], 128, 60)
    })
    const frente = estandar(0xffffff, { map: etiqueta, roughness: 0.9 })
    caja(ancho, t, ancho, m.carton, 0, t / 2, 0, g)
    caja(ancho, alto, t, m.carton, 0, alto / 2, -ancho / 2 + t / 2, g)
    alta(
      new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, t), [
        m.carton,
        m.carton,
        m.carton,
        m.carton,
        frente,
        m.carton,
      ]),
      g,
      0,
      alto / 2,
      ancho / 2 - t / 2,
    )
    for (const s of [-1, 1])
      caja(t, alto, ancho, m.carton, s * (ancho / 2 - t / 2), alto / 2, 0, g)
    const solapas = [-1, 1].map((lado) => {
      const pivote = new THREE.Group()
      pivote.position.set((lado * ancho) / 2, alto, 0)
      g.add(pivote)
      caja(
        ancho / 2 - 0.002,
        0.003,
        ancho - 0.002,
        m.carton,
        -lado * (ancho / 4),
        0,
        0,
        pivote,
      )
      return { pivote, lado }
    })
    return { grupo: g, solapas }
  })
}

// Tarima donde se apilan las cajas terminadas; cada una lleva una cinta del color de su material.
function tarima(escena: THREE.Scene, m: Materiales) {
  const T = new THREE.Group()
  T.position.set(1.32, 0, 0.35)
  escena.add(T)
  for (const z of [-0.17, 0, 0.17])
    caja(0.5, 0.05, 0.06, m.madera, 0, 0.025, z, T)
  for (let i = 0; i < 5; i++)
    caja(0.09, 0.015, 0.4, m.madera, -0.205 + i * 0.1025, 0.0575, 0, T)
  const cintas: Record<Tipo, THREE.Material> = {
    al: estandar(0x5c6b78),
    pl: estandar(0x1d2126),
  }
  const lugares = []
  for (let i = 0; i < CAJAS_POR_TARIMA; i++) {
    const capa = Math.floor(i / 6)
    const k = i % 6
    const bulto = caja(
      0.16,
      0.079,
      0.16,
      m.carton,
      -0.17 + (k % 3) * 0.17,
      0.105 + capa * 0.08,
      k < 3 ? -0.09 : 0.09,
      T,
    )
    const cinta = caja(0.162, 0.03, 0.162, cintas.al, 0, 0, 0, bulto)
    cinta.castShadow = false
    bulto.visible = false
    lugares.push({ bulto, cinta })
  }
  return { lugares, cintas }
}

// Los cubos que se clasifican. La marca es el anillo que deja el punzon.
function piezas(E: Grupo) {
  const cubo = new RoundedBoxGeometry(0.05, 0.05, 0.05, 3, 0.004)
  const hoyo = new THREE.CircleGeometry(0.011, 20)
  const anillo = new THREE.RingGeometry(0.014, 0.019, 28)
  const negro = basico(0x0b0d10)
  const turquesa = basico(0x39b8c4)
  const lista = []
  for (let i = 0; i < TOTAL_PIEZAS; i++) {
    const malla = alta(
      new THREE.Mesh<THREE.BufferGeometry, THREE.Material>(cubo),
      E,
      0,
      0,
      0,
    )
    const centro = new THREE.Mesh(hoyo, negro)
    centro.rotation.x = -Math.PI / 2
    centro.position.y = 0.0256
    malla.add(centro)
    const marca = new THREE.Mesh(anillo, turquesa)
    marca.rotation.x = -Math.PI / 2
    marca.position.y = 0.0258
    marca.visible = false
    malla.add(marca)
    lista.push({ malla, marca })
  }
  return lista
}

export function construirCelda(escena: THREE.Scene, E: Grupo, m: Materiales) {
  bancada(E, m)
  guia(E, m)
  deposito(E, m)
  const pist = pistones(E, m)
  almacen(E, m)
  const focos = sensores(E, m)
  const { carro, banderas, acomodarCadena } = portico(E, m, pist.Z)
  rampa(E, m)
  return {
    pistones: pist,
    focos,
    carro,
    banderas,
    acomodarCadena,
    cajas: cajasEmpaque(E, m),
    tarima: tarima(escena, m),
    piezas: piezas(E),
  }
}

export type Celda = ReturnType<typeof construirCelda>
