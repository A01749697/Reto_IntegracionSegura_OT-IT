// La nave industrial alrededor de la celda: piso, muros, estantería, cerca de seguridad,
// gabinete eléctrico y el pedestal del operador con su pantalla.
import * as THREE from 'three'
import {
  basico,
  caja,
  cajaR,
  cil,
  estandar,
  tapete,
  textura,
  type Materiales,
} from './materiales'
import type { EstadoCelda } from './estado'
import type { Senales } from './senales'

const AMARILLO = 0xe0b21a

function ruido(g: CanvasRenderingContext2D, w: number, h: number, n: number) {
  for (let i = 0; i < n; i++) {
    const tono = Math.random() < 0.5 ? '255,255,255' : '0,0,0'
    g.fillStyle = `rgba(${tono},${Math.random() * 0.05})`
    g.fillRect(Math.random() * w, Math.random() * h, 3, 3)
  }
}

function piso(escena: THREE.Scene, tFranjas: THREE.Texture) {
  const tConcreto = textura(
    512,
    512,
    (g, w, h) => {
      g.fillStyle = '#8b9196'
      g.fillRect(0, 0, w, h)
      ruido(g, w, h, 9000)
      for (let i = 0; i < 14; i++) {
        g.fillStyle = `rgba(40,44,48,${0.03 + Math.random() * 0.05})`
        g.beginPath()
        g.ellipse(
          Math.random() * w,
          Math.random() * h,
          30 + Math.random() * 70,
          14 + Math.random() * 30,
          Math.random() * 3,
          0,
          7,
        )
        g.fill()
      }
      g.strokeStyle = 'rgba(30,34,38,.55)'
      g.lineWidth = 3
      g.strokeRect(0, 0, w, h)
    },
    [8, 8],
  )
  tapete(
    48,
    48,
    estandar(0xffffff, { map: tConcreto, roughness: 0.5, metalness: 0.05 }),
    0,
    0,
    0,
    escena,
  )
  // pasillo peatonal verde y delimitacion amarilla de la celda
  const raya = estandar(AMARILLO)
  tapete(30, 1.5, estandar(0x2f7d52), 0, 3, 0.003, escena)
  tapete(30, 0.08, raya, 0, 2.21, 0.004, escena)
  tapete(30, 0.08, raya, 0, 3.79, 0.004, escena)
  tapete(4.3, 0.08, raya, 0.05, 1.2, 0.004, escena)
  tapete(4.3, 0.08, raya, 0.05, -1.42, 0.004, escena)
  tapete(0.08, 2.7, raya, 2.2, -0.11, 0.004, escena)
  tapete(0.08, 2.7, raya, -2.1, -0.11, 0.004, escena)
  // zona de la tarima de producto
  tapete(
    0.95,
    0.8,
    estandar(0xffffff, { map: tFranjas }),
    1.32,
    0.35,
    0.005,
    escena,
  )
  tapete(0.75, 0.6, estandar(0x7d8388), 1.32, 0.35, 0.006, escena)
}

// Lo que esta lejos no proyecta sombra: asi rinde mas.
function fondo(
  escena: THREE.Scene,
  m: Materiales,
  tFranjas: THREE.Texture,
  cargas: THREE.Material[],
) {
  const lejos = new THREE.Group()
  escena.add(lejos)

  const tLamina = textura(
    64,
    64,
    (g) => {
      g.fillStyle = '#aab4bc'
      g.fillRect(0, 0, 64, 64)
      g.fillStyle = '#8f9aa3'
      g.fillRect(0, 0, 10, 64)
      g.fillStyle = '#c3ccd3'
      g.fillRect(30, 0, 8, 64)
    },
    [60, 1],
  )
  const lamina = estandar(0xffffff, {
    map: tLamina,
    roughness: 0.7,
    metalness: 0.2,
  })
  const zoclo = estandar(0x596169, { roughness: 0.9 })
  const muro = (ancho: number, x: number, z: number, giro: number) => {
    for (const [alto, y, material] of [
      [1.3, 0.65, zoclo],
      [6.2, 4.4, lamina],
    ] as const) {
      const pared = new THREE.Mesh(
        new THREE.PlaneGeometry(ancho, alto),
        material,
      )
      pared.position.set(x, y, z)
      pared.rotation.y = giro
      lejos.add(pared)
    }
  }
  muro(30, 0, -4.6, 0)
  muro(22, -9, 2, Math.PI / 2)
  muro(22, 9.5, 2, -Math.PI / 2)

  // columnas y vigas del techo
  const columna = estandar(0x2c5d8c, { roughness: 0.6, metalness: 0.3 })
  const protector = estandar(AMARILLO, { map: tFranjas })
  for (const x of [-8, -4, 0, 4, 8]) {
    caja(0.26, 7.5, 0.26, columna, x, 3.75, -4.4, lejos)
    caja(0.34, 1.1, 0.34, protector, x, 0.55, -4.4, lejos)
    caja(0.18, 0.3, 14, m.viga, x, 7.1, 2.4, lejos)
  }
  for (const z of [-2, 2, 6]) caja(18, 0.12, 0.12, m.viga, 0, 6.9, z, lejos)

  // lamparas colgantes
  const luz = basico(0xfff6dd)
  for (const x of [-4, 0, 4]) {
    for (const z of [-1.5, 2.5]) {
      cil(0.22, 0.16, m.viga, x, 6.35, z, 'y', lejos, 20, 0.12)
      cil(0.2, 0.01, luz, x, 6.265, z, 'y', lejos, 20)
      caja(0.02, 0.5, 0.02, m.viga, x, 6.65, z, lejos)
      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: m.tBrillo,
          color: 0xfff1cc,
          blending: THREE.AdditiveBlending,
          transparent: true,
          depthWrite: false,
          opacity: 0.55,
        }),
      )
      halo.scale.setScalar(1.6)
      halo.position.set(x, 6.25, z)
      lejos.add(halo)
    }
  }

  // estanteria de tarimas contra el muro
  const poste = estandar(0x24508a, { roughness: 0.6, metalness: 0.3 })
  const larguero = estandar(0xe0701a, { roughness: 0.6, metalness: 0.2 })
  for (let b = 0; b <= 4; b++) {
    for (const z of [-3.25, -4.2])
      caja(0.09, 5.2, 0.09, poste, -5.4 + b * 2.7, 2.6, z, lejos)
  }
  for (let b = 0; b < 4; b++) {
    const centro = -5.4 + b * 2.7 + 1.35
    for (const [nivel, y] of [
      [0, 0.07],
      [1, 1.85],
      [2, 3.55],
    ]) {
      if (nivel) {
        for (const z of [-3.25, -4.2])
          caja(2.62, 0.11, 0.05, larguero, centro, y - 0.06, z, lejos)
      }
      for (const dx of [-0.64, 0.64]) {
        const lado = dx > 0 ? 1 : 0
        const carga = (b * 7 + nivel * 3 + lado) % 5
        if (carga === 4) continue // hueco vacio
        const alto = 0.7 + ((b + nivel * 2 + lado) % 3) * 0.2
        caja(1.1, 0.13, 0.95, m.madera, centro + dx, y + 0.065, -3.72, lejos)
        caja(
          1.02,
          alto,
          0.88,
          cargas[carga],
          centro + dx,
          y + 0.13 + alto / 2,
          -3.72,
          lejos,
        )
      }
    }
  }
  lejos.traverse((o) => {
    o.castShadow = false
  })
}

// Cerca de malla atras y a los lados; el frente queda con barrera de luz.
function cercaSeguridad(cerca: THREE.Group) {
  const tubo = estandar(0xe6b317, { roughness: 0.55, metalness: 0.2 })
  const tMalla = textura(64, 64, (g) => {
    g.clearRect(0, 0, 64, 64)
    g.strokeStyle = 'rgba(20,23,26,.6)'
    g.lineWidth = 4
    g.strokeRect(0, 0, 64, 64)
  })
  const tramo = (x0: number, z0: number, x1: number, z1: number) => {
    const largo = Math.hypot(x1 - x0, z1 - z0)
    const n = Math.round(largo / 1.05)
    const giro = -Math.atan2(z1 - z0, x1 - x0)
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n
      const z = z0 + ((z1 - z0) * i) / n
      caja(0.05, 2, 0.05, tubo, x, 1, z, cerca)
      caja(0.14, 0.012, 0.14, tubo, x, 0.006, z, cerca)
    }
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n
      const ancho = largo / n - 0.07
      const x = x0 + (x1 - x0) * t
      const z = z0 + (z1 - z0) * t
      const malla = tMalla.clone()
      malla.wrapS = malla.wrapT = THREE.RepeatWrapping
      malla.repeat.set(Math.round(ancho / 0.045), Math.round(1.75 / 0.045))
      malla.needsUpdate = true
      const pano = new THREE.Mesh(
        new THREE.PlaneGeometry(ancho, 1.75),
        new THREE.MeshBasicMaterial({
          map: malla,
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      )
      pano.position.set(x, 1.07, z)
      pano.rotation.y = giro
      cerca.add(pano)
      for (const y of [1.95, 0.19])
        caja(ancho, 0.03, 0.03, tubo, x, y, z, cerca).rotation.y = giro
    }
  }
  tramo(-2.1, -1.42, 2.2, -1.42)
  tramo(-2.1, -1.42, -2.1, 0.7)
  tramo(2.2, -1.42, 2.2, 0.7)
  for (const x of [-2.1, 2.2]) {
    caja(0.06, 1.5, 0.06, tubo, x, 0.75, 1.15, cerca)
    caja(0.16, 0.012, 0.16, tubo, x, 0.006, 1.15, cerca)
    const haz = x + (x < 0 ? 0.034 : -0.034)
    caja(0.012, 1.2, 0.03, basico(0xd2281f), haz, 0.85, 1.15, cerca)
  }
  return tubo
}

// Gabinete electrico de piso con su ducto hacia la maquina.
function gabinete(cerca: THREE.Group, m: Materiales, tubo: THREE.Material) {
  const x = -1.62
  const z = -0.98
  const lamina = estandar(0xc9ced2, { roughness: 0.55, metalness: 0.2 })
  const puerta = estandar(0xd5dade, { roughness: 0.5, metalness: 0.2 })
  cajaR(0.8, 1.9, 0.42, lamina, x, 1.05, z, cerca, 0.01)
  caja(0.82, 0.1, 0.44, m.viga, x, 0.05, z, cerca)
  for (const dx of [-0.2, 0.2]) {
    caja(0.385, 1.8, 0.006, puerta, x + dx, 1.05, z + 0.212, cerca)
    caja(0.02, 0.12, 0.02, m.viga, x + dx * 0.15, 1.05, z + 0.225, cerca)
  }
  // interruptor general y pilotos
  cil(0.045, 0.02, tubo, x + 0.2, 1.45, z + 0.222, 'z', cerca, 20)
  const perilla = estandar(0xd0261c, { roughness: 0.4 })
  caja(0.03, 0.07, 0.03, perilla, x + 0.2, 1.45, z + 0.24, cerca)
  ;[0x3fd07a, 0x39424a, 0x39424a].forEach((color, i) =>
    cil(
      0.016,
      0.012,
      basico(color),
      x - 0.28 + i * 0.06,
      1.7,
      z + 0.218,
      'z',
      cerca,
      14,
    ),
  )
  for (let i = 0; i < 7; i++)
    caja(0.2, 0.008, 0.004, m.viga, x - 0.2, 0.42 - i * 0.022, z + 0.216, cerca)
  caja(0.16, 0.06, 1, m.viga, x + 0.33, 1.97, z + 0.29, cerca)
  caja(1.15, 0.06, 0.16, m.viga, x + 0.85, 1.97, -0.6, cerca)
  caja(0.1, 0.72, 0.06, m.viga, -0.3, 1.63, -0.6, cerca)
}

// Pedestal del operador. Devuelve el lienzo de su pantalla para irlo repintando.
function pedestal(cerca: THREE.Group, m: Materiales) {
  const x = -1.5
  const z = 0.82
  caja(0.34, 0.02, 0.34, m.viga, x, 0.01, z, cerca)
  caja(0.08, 1.1, 0.08, m.viga, x, 0.56, z, cerca)
  const consola = new THREE.Group()
  consola.position.set(x, 1.25, z)
  consola.rotation.set(-0.35, 0.5, 0, 'YXZ')
  cerca.add(consola)
  const carcasa = estandar(0x2b3138, { roughness: 0.5, metalness: 0.3 })
  cajaR(0.46, 0.32, 0.07, carcasa, 0, 0, 0, consola, 0.012)

  const lienzo = document.createElement('canvas')
  lienzo.width = 256
  lienzo.height = 160
  const tPantalla = new THREE.CanvasTexture(lienzo)
  tPantalla.colorSpace = THREE.SRGBColorSpace
  const pantalla = new THREE.Mesh(
    new THREE.PlaneGeometry(0.38, 0.2375),
    new THREE.MeshBasicMaterial({ map: tPantalla }),
  )
  pantalla.position.set(0, 0.022, 0.0365)
  consola.add(pantalla)
  ;[0x2fbf62, 0xd8392f, 0x2f7fd6, 0xe9eef2].forEach((color, i) =>
    cil(
      0.012,
      0.01,
      estandar(color, { roughness: 0.4 }),
      -0.15 + i * 0.045,
      -0.125,
      0.037,
      'z',
      consola,
      14,
    ),
  )
  return { g: lienzo.getContext('2d'), tPantalla }
}

// Texto y color de la franja de arriba de la pantalla, por estado de la celda.
const PANTALLA: Record<EstadoCelda, [string, string]> = {
  marcha: ['EN MARCHA', '#3fd07a'],
  mantenimiento: ['MANTENIMIENTO', '#f2b233'],
  reset: ['RESET / REGRESO A INICIO', '#f2b233'],
  paro: ['PARO', '#f0524a'],
  falla: ['FALLA', '#f0524a'],
  sinDato: ['SIN DATO', '#8fa3b1'],
  sinComunicacion: ['SIN COMUNICACION', '#8fa3b1'],
}

export function construirNave(escena: THREE.Scene, m: Materiales) {
  const tFranjas = textura(
    64,
    64,
    (g) => {
      g.fillStyle = '#e0b21a'
      g.fillRect(0, 0, 64, 64)
      g.fillStyle = '#15181b'
      g.beginPath()
      g.moveTo(0, 64)
      g.lineTo(32, 64)
      g.lineTo(64, 32)
      g.lineTo(64, 0)
      g.closePath()
      g.fill()
      g.beginPath()
      g.moveTo(0, 0)
      g.lineTo(0, 32)
      g.lineTo(32, 0)
      g.closePath()
      g.fill()
    },
    [5, 4],
  )
  const cargas = [
    estandar(0xb98a56, { roughness: 0.9 }),
    estandar(0xd8dde1, { roughness: 0.35 }),
    estandar(0x8f6f45, { roughness: 0.9 }),
    estandar(0x5f7f9a, { roughness: 0.6 }),
  ]

  piso(escena, tFranjas)
  fondo(escena, m, tFranjas, cargas)

  const junto = new THREE.Group() // junto a la celda: con sombras
  escena.add(junto)
  const tubo = cercaSeguridad(junto)
  gabinete(junto, m, tubo)
  const { g, tPantalla } = pedestal(junto, m)

  // bajada de aire comprimido desde la nave
  cil(0.022, 5.3, m.azul, 1.3, 4.25, -1.2, 'y', junto, 14)
  cil(0.022, 0.75, m.azul, 1.3, 1.6, -0.84, 'z', junto, 14)
  cil(0.022, 0.72, m.azul, 1.3, 1.25, -0.47, 'y', junto, 14)
  cil(0.035, 0.07, m.laton, 1.3, 1.6, -1.2, 'y', junto, 14)
  cil(0.035, 0.07, m.laton, 1.3, 1.6, -0.47, 'y', junto, 14)
  // tarima de carton plano
  caja(1.1, 0.13, 0.9, m.madera, 1.45, 0.065, -0.72, junto)
  for (let i = 0; i < 5; i++) {
    caja(
      0.5,
      0.045,
      0.4,
      cargas[0],
      1.2 + (i % 2) * 0.5,
      0.155 + Math.floor(i / 2) * 0.047,
      -0.72 + (i % 2 ? 0.05 : -0.05),
      junto,
    )
  }
  // extintor
  const rojo = estandar(0xc9241c, { roughness: 0.4 })
  cil(0.07, 0.42, rojo, -2, 0.6, -1.3, 'y', junto, 16)
  cil(0.02, 0.1, m.viga, -2, 0.85, -1.3, 'y', junto, 10)

  // La pantalla del operador repite el estado de la celda y los contadores.
  function pintarPantalla(s: Senales) {
    if (!g) return
    const [texto, fondo] = PANTALLA[s.estado]
    g.fillStyle = '#0d1820'
    g.fillRect(0, 0, 256, 160)
    g.fillStyle = fondo
    g.fillRect(0, 0, 256, 26)
    g.fillStyle = '#0d1820'
    g.font = '700 14px Arial'
    g.textAlign = 'left'
    g.fillText(
      s.estado === 'falla' ? `${texto}  COD ${s.codFalla}` : texto,
      8,
      18,
    )
    g.fillStyle = '#8fa3b1'
    g.font = '12px Arial'
    g.fillText('PASO', 12, 46)
    g.fillText('ALUMINIO', 96, 46)
    g.fillText('PLASTICO', 176, 46)
    g.fillText('CAJAS AL / PL', 12, 112)
    g.fillStyle = '#e6eef3'
    g.font = '700 30px Arial'
    g.fillText(s.pasoReal === null ? '-' : String(s.pasoReal), 12, 82)
    g.fillText(String(s.piezasAl), 96, 82)
    g.fillText(String(s.piezasPl), 176, 82)
    g.font = '700 24px Arial'
    g.fillText(`${s.cajasAl} / ${s.cajasPl}`, 12, 142)
    tPantalla.needsUpdate = true
  }

  return { pintarPantalla }
}
