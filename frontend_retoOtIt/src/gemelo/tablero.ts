// Lo que controla la celda: tablero trasero con el PLC y las electroválvulas,
// la unidad de aire, las mangueras, la torreta y la botonera.
import * as THREE from 'three'
import { CADENA, type Piston } from './celda'
import type { Mando } from './gemelo'
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
  prender,
  textura,
  type Led,
  type Materiales,
} from './materiales'
import { Z_PORTICO, type P3 } from './medidas'

type Grupo = THREE.Group
type Valvula = { foco: Led; x: number; y: number; z: number }

const Z_FRENTE = -0.439 // cara del tablero

// frente de un modulo del PLC: franja con su nombre y zona de bornes
function frenteModulo(lineas: [string, string], w: number) {
  const h = 256
  return textura(w, h, (g) => {
    g.fillStyle = '#cdd2d6'
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#33414c'
    g.fillRect(0, 0, w, 46)
    g.fillStyle = '#fff'
    g.font = '600 17px Arial'
    g.textAlign = 'center'
    g.fillText(lineas[0], w / 2, 20)
    g.font = '13px Arial'
    g.fillText(lineas[1], w / 2, 38)
    g.fillStyle = '#b3babf'
    g.fillRect(8, 60, w - 16, h - 72)
    g.strokeStyle = '#8f979d'
    g.strokeRect(8.5, 60.5, w - 17, h - 73)
  })
}

// Riel con la fuente, la CPU y las tarjetas de entradas y salidas, cada una con sus focos.
function plc(E: Grupo, m: Materiales) {
  const zf = Z_FRENTE
  caja(1.05, 0.46, 0.012, m.panel, -0.35, 0.23, -0.445, E)
  const marco = estandar(0x34424f, { roughness: 0.55, metalness: 0.35 })
  caja(1.1, 0.014, 0.19, marco, -0.35, 0.468, -0.36, E)
  for (const x of [-0.893, 0.193])
    caja(0.014, 0.475, 0.19, marco, x, 0.2375, -0.36, E)
  for (const x of [-0.86, 0.16])
    caja(0.03, 0.46, 0.03, m.perfilV, x, 0.23, -0.445, E)
  // canaleta con su placa
  caja(1, 0.04, 0.045, m.grisClaro, -0.35, 0.425, zf + 0.022, E)
  for (let i = 0; i < 40; i++)
    caja(0.004, 0.028, 0.002, m.gris, -0.84 + i * 0.025, 0.425, zf + 0.0455, E)
  const placa = letrero(0.26, 0.034, [332, 44], (g) => {
    g.fillStyle = '#10171d'
    g.fillRect(0, 0, 332, 44)
    g.fillStyle = '#e6eef3'
    g.font = '600 24px Arial'
    g.textAlign = 'center'
    g.fillText('CELDA CLASIFICADORA', 166, 30)
  })
  placa.position.set(-0.35, 0.425, zf + 0.047)
  E.add(placa)

  caja(0.36, 0.035, 0.008, m.acero, -0.6, 0.25, zf + 0.004, E) // riel
  const lateral = estandar(0xc6cbcf)
  const modulo = (x: number, w: number, rotulo: [string, string]) => {
    const frente = estandar(0xffffff, {
      map: frenteModulo(rotulo, Math.round(w * 1600)),
    })
    alta(
      new THREE.Mesh(new THREE.BoxGeometry(w - 0.002, 0.125, 0.12), [
        lateral,
        lateral,
        lateral,
        lateral,
        frente,
        lateral,
      ]),
      E,
      x,
      0.25,
      zf + 0.068,
    )
  }
  modulo(-0.745, 0.05, ['PS', '24 V'])
  modulo(-0.68, 0.08, ['CPU 315F', 'PN/DP'])
  modulo(-0.62, 0.04, ['DI', '16x'])
  modulo(-0.58, 0.04, ['DQ', '16x'])

  const foco = (x: number, y: number, color: number) => {
    const f = led(color)
    caja(0.006, 0.004, 0.002, f, x, y, zf + 0.129, E).castShadow = false
    return f
  }
  prender(foco(-0.745, 0.28, 0x3fd07a), true) // la fuente siempre esta encendida
  const cpu = {
    falla: foco(-0.705, 0.285, 0xf0524a),
    alimentada: foco(-0.705, 0.277, 0x3fd07a),
    corriendo: foco(-0.705, 0.269, 0x3fd07a),
    detenida: foco(-0.705, 0.261, 0xf2b233),
  }
  const entradas: Led[] = []
  const salidas: Led[] = []
  for (let i = 0; i < 14; i++)
    entradas.push(foco(-0.632, 0.285 - i * 0.0072, 0x3fd07a))
  for (let i = 0; i < 9; i++)
    salidas.push(foco(-0.592, 0.285 - i * 0.0072, 0x3fd07a))

  // mazos de cable hacia las valvulas
  manguera(
    [
      [-0.62, 0.19, zf + 0.1],
      [-0.62, 0.15, zf + 0.06],
      [-0.5, 0.1, zf + 0.03],
      [-0.3, 0.07, zf + 0.03],
    ],
    0.006,
    m.cable,
    E,
  )
  manguera(
    [
      [-0.58, 0.19, zf + 0.1],
      [-0.57, 0.14, zf + 0.07],
      [-0.4, 0.17, zf + 0.03],
      [-0.2, 0.2, zf + 0.04],
    ],
    0.006,
    m.cable,
    E,
  )
  return { cpu, entradas, salidas }
}

// Isla de valvulas: V1 alimentador, V2 sujecion, V3 marcador (3/2, mas corta) y V4-V6 del portico.
function valvulas(E: Grupo, m: Materiales): Valvula[] {
  const zf = Z_FRENTE
  caja(0.25, 0.022, 0.06, m.alu, -0.18, 0.1, zf + 0.03, E)
  const isla: Valvula[] = []
  for (let i = 0; i < 6; i++) {
    const x = -0.28 + i * 0.04
    const corta = i === 2
    cajaR(
      0.03,
      0.045,
      corta ? 0.055 : 0.075,
      m.grisClaro,
      x,
      0.1335,
      zf + (corta ? 0.03 : 0.04),
      E,
      0.003,
    )
    cajaR(0.028, 0.03, 0.03, m.negro, x, 0.17, zf + 0.025, E, 0.003)
    if (i < 2) cajaR(0.028, 0.024, 0.02, m.negro, x, 0.165, zf + 0.06, E, 0.003)
    const foco = led(0xffb020)
    caja(0.01, 0.004, 0.008, foco, x, 0.187, zf + 0.025, E)
    isla.push({ foco, x, y: 0.125, z: zf + (corta ? 0.058 : 0.078) })
  }
  return isla
}

// Unidad de mantenimiento con su manometro. Devuelve la aguja.
function unidadDeAire(E: Grupo, m: Materiales) {
  const zf = Z_FRENTE
  const x = 0.06
  cajaR(0.06, 0.05, 0.05, m.aluOsc, x, 0.22, zf + 0.03, E, 0.004)
  cil(0.022, 0.075, m.cristal, x, 0.155, zf + 0.03, 'y', E, 20).castShadow =
    false
  cil(0.023, 0.012, m.negro, x, 0.113, zf + 0.03, 'y', E, 20)
  cil(0.016, 0.03, m.negro, x, 0.265, zf + 0.03, 'y', E, 16)
  cil(0.024, 0.012, m.negro, x, 0.22, zf + 0.062, 'z', E, 24)
  const caratula = new THREE.Mesh(
    new THREE.CircleGeometry(0.021, 28),
    new THREE.MeshBasicMaterial({
      map: textura(128, 128, (g) => {
        g.fillStyle = '#f4f4f0'
        g.beginPath()
        g.arc(64, 64, 64, 0, 7)
        g.fill()
        g.strokeStyle = '#222'
        g.lineWidth = 3
        for (let i = 0; i <= 10; i++) {
          const a = Math.PI * 0.75 + i * Math.PI * 0.15
          g.beginPath()
          g.moveTo(64 + Math.cos(a) * 46, 64 + Math.sin(a) * 46)
          g.lineTo(64 + Math.cos(a) * 58, 64 + Math.sin(a) * 58)
          g.stroke()
        }
        g.fillStyle = '#222'
        g.font = '600 18px Arial'
        g.textAlign = 'center'
        g.fillText('bar', 64, 100)
      }),
    }),
  )
  caratula.position.set(x, 0.22, zf + 0.0685)
  E.add(caratula)
  const aguja = new THREE.Group()
  aguja.position.set(x, 0.22, zf + 0.0695)
  E.add(aguja)
  const punta = new THREE.Mesh(
    new THREE.PlaneGeometry(0.002, 0.017),
    basico(0xc0261e),
  )
  punta.position.y = 0.0065
  aguja.add(punta)
  manguera(
    [
      [x + 0.03, 0.22, zf + 0.03],
      [x + 0.07, 0.2, zf + 0.05],
      [0.14, 0.03, -0.4],
      [0.6, 0.012, -0.4],
      [0.96, 0, -0.45],
    ],
    0.006,
    m.manguera,
    E,
  )
  manguera(
    [
      [x - 0.03, 0.22, zf + 0.03],
      [-0.02, 0.19, zf + 0.06],
      [-0.04, 0.12, zf + 0.05],
      [-0.055, 0.1, zf + 0.03],
    ],
    0.005,
    m.manguera,
    E,
  )
  return aguja
}

// V1-V3 van a sus cilindros (azules); V4-V6 suben al portico por la cadena (amarillas).
function mangueras(
  E: Grupo,
  m: Materiales,
  isla: Valvula[],
  cilindros: Piston[],
) {
  E.updateMatrixWorld(true)
  cilindros.forEach((piston, i) => {
    const v = isla[i]
    const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(
      piston.grupo.quaternion,
    )
    piston.puertos.forEach((puerto, j) => {
      const fin = E.worldToLocal(piston.grupo.localToWorld(puerto.clone()))
      const doble = piston.puertos.length > 1
      const inicio: P3 = [v.x + (doble ? (j ? 0.007 : -0.007) : 0), v.y, v.z]
      const antes = fin.clone().addScaledVector(normal, 0.06)
      manguera(
        [
          inicio,
          [inicio[0], inicio[1] - 0.03, inicio[2] + 0.05],
          [(inicio[0] + antes.x) / 2, 0.035 + i * 0.012 + j * 0.01, -0.33],
          [antes.x, antes.y, antes.z],
          [fin.x, fin.y, fin.z],
        ],
        0.0038,
        m.manguera,
        E,
      )
    })
  })
  for (let i = 3; i < 6; i++) {
    const v = isla[i]
    manguera(
      [
        [v.x, v.y, v.z],
        [v.x, v.y - 0.04, v.z + 0.05],
        [0.12, 0.02 + i * 0.006, -0.36],
        [0.24, 0.2, Z_PORTICO + 0.045],
        [0.25, 0.42, Z_PORTICO + 0.05 + i * 0.004],
        [CADENA.x0, CADENA.y0, CADENA.z - 0.03 + i * 0.008],
      ],
      0.0036,
      m.mangueraAmarilla,
      E,
    )
  }
}

function torreta(E: Grupo, m: Materiales) {
  const x = -0.93
  const z = -0.41
  cil(0.03, 0.012, m.negro, x, 0.006, z, 'y', E)
  cil(0.011, 0.3, m.alu, x, 0.16, z, 'y', E, 16)
  cil(0.03, 0.02, m.negro, x, 0.32, z, 'y', E)
  const luz = (color: number, nivel: number) => {
    const lente = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.05,
      roughness: 0.25,
      transparent: true,
      opacity: 0.9,
    })
    const y = 0.356 + nivel * 0.054
    cil(0.028, 0.05, lente, x, y, z, 'y', E, 28).castShadow = false
    cil(0.03, 0.004, m.negro, x, y + 0.027, z, 'y', E, 28)
    const halo = new THREE.SpriteMaterial({
      map: m.tBrillo,
      color,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0,
    })
    const resplandor = new THREE.Sprite(halo)
    resplandor.scale.setScalar(0.3)
    resplandor.position.set(x, y, z)
    E.add(resplandor)
    return { lente, halo }
  }
  const luces = {
    verde: luz(0x2fd36b, 0),
    amarilla: luz(0xf5b81c, 1),
    roja: luz(0xf2392f, 2),
  }
  cil(0.03, 0.012, m.negro, x, 0.498, z, 'y', E, 28, 0.02)
  return luces
}

// Botonera: marcha, paro, restablecer y el hongo de emergencia. Se le puede hacer clic.
function botonera(E: Grupo, m: Materiales) {
  const b = new THREE.Group()
  b.position.set(-0.7, 0.04, 0.34)
  b.rotation.x = 0.4
  E.add(b)
  cajaR(0.2, 0.07, 0.12, m.grisClaro, -0.045, 0, 0, b, 0.008)
  cajaR(0.095, 0.085, 0.12, m.amarillo, 0.115, 0.007, 0, b, 0.008)
  const pulsables: THREE.Object3D[] = []
  const boton = (x: number, color: number, mando: Mando) => {
    cil(0.019, 0.006, m.acero, x, 0.038, 0, 'y', b, 24)
    const luz = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.05,
      roughness: 0.35,
    })
    const tapa = cil(0.015, 0.014, luz, x, 0.046, 0, 'y', b, 24)
    tapa.userData.mando = mando
    pulsables.push(tapa)
    return luz
  }
  const luces = {
    marcha: boton(-0.105, 0x2fbf62, 'marcha'),
    paro: boton(-0.045, 0xd8392f, 'paro'),
    restablecer: boton(0.015, 0x2f7fd6, 'restablecer'),
  }
  cil(0.03, 0.006, m.negro, 0.115, 0.052, 0, 'y', b, 28)
  cil(0.012, 0.016, m.negro, 0.115, 0.06, 0, 'y', b, 16)
  const hongo = cil(
    0.026,
    0.018,
    estandar(0xd0261c, { roughness: 0.4 }),
    0.115,
    0.076,
    0,
    'y',
    b,
    28,
    0.021,
  )
  hongo.userData.mando = 'emergencia' satisfies Mando
  pulsables.push(hongo)
  manguera(
    [
      [-0.84, 0.03, 0.31],
      [-0.9, 0.01, 0.2],
      [-0.92, 0.01, -0.2],
      [-0.8, 0.03, -0.43],
    ],
    0.005,
    m.cable,
    E,
  )
  return { pulsables, luces, hongo }
}

export function construirTablero(
  E: Grupo,
  m: Materiales,
  cilindros: { A: Piston; B: Piston; C: Piston },
) {
  const { cpu, entradas, salidas } = plc(E, m)
  const isla = valvulas(E, m)
  const aguja = unidadDeAire(E, m)
  mangueras(E, m, isla, [cilindros.A, cilindros.B, cilindros.C])
  return {
    cpu,
    entradas,
    salidas,
    valvulas: isla.map((v) => v.foco),
    aguja,
    torreta: torreta(E, m),
    botonera: botonera(E, m),
  }
}

export type Tablero = ReturnType<typeof construirTablero>
