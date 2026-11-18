// Texturas, materiales y atajos de geometría con los que se arma la escena.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { P3 } from './medidas'

export type Led = THREE.MeshStandardMaterial
type Padre = THREE.Object3D | undefined
type Dibujo = (g: CanvasRenderingContext2D, w: number, h: number) => void

// Las texturas se pintan en un lienzo: no hay que descargar ninguna imagen.
export function textura(
  w: number,
  h: number,
  dibujar: Dibujo,
  repetir?: [number, number],
): THREE.CanvasTexture {
  const lienzo = document.createElement('canvas')
  lienzo.width = w
  lienzo.height = h
  const g = lienzo.getContext('2d')
  if (g) dibujar(g, w, h)
  const t = new THREE.CanvasTexture(lienzo)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  if (repetir) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(repetir[0], repetir[1])
  }
  return t
}

export const estandar = (
  color: number,
  opciones: THREE.MeshStandardMaterialParameters = {},
) =>
  new THREE.MeshStandardMaterial({
    color,
    roughness: 0.6,
    metalness: 0,
    ...opciones,
  })

export const basico = (color: number) => new THREE.MeshBasicMaterial({ color })

export const led = (color: number): Led =>
  new THREE.MeshStandardMaterial({
    color: 0x20262b,
    emissive: color,
    emissiveIntensity: 0,
    roughness: 0.4,
  })

export function prender(foco: Led | null, encendido: boolean, fuerza = 2.4) {
  if (foco) foco.emissiveIntensity = encendido ? fuerza : 0
}

export function alta<T extends THREE.Object3D>(
  objeto: T,
  padre: Padre,
  x: number,
  y: number,
  z: number,
): T {
  objeto.position.set(x, y, z)
  objeto.castShadow = true
  objeto.receiveShadow = true
  padre?.add(objeto)
  return objeto
}

export const caja = (
  w: number,
  h: number,
  d: number,
  m: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  padre?: Padre,
) => alta(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), padre, x, y, z)

// caja con los cantos redondeados
export const cajaR = (
  w: number,
  h: number,
  d: number,
  m: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  padre?: Padre,
  radio?: number,
) =>
  alta(
    new THREE.Mesh(
      new RoundedBoxGeometry(w, h, d, 3, radio ?? Math.min(w, h, d) * 0.16),
      m,
    ),
    padre,
    x,
    y,
    z,
  )

export function cil(
  radio: number,
  largo: number,
  m: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  eje: 'x' | 'y' | 'z' = 'y',
  padre?: Padre,
  segmentos = 24,
  radioArriba?: number,
) {
  const o = alta(
    new THREE.Mesh(
      new THREE.CylinderGeometry(radioArriba ?? radio, radio, largo, segmentos),
      m,
    ),
    padre,
    x,
    y,
    z,
  )
  if (eje === 'x') o.rotation.z = Math.PI / 2
  else if (eje === 'z') o.rotation.x = Math.PI / 2
  return o
}

export function manguera(
  puntos: P3[],
  radio: number,
  m: THREE.Material,
  padre: Padre,
) {
  const curva = new THREE.CatmullRomCurve3(
    puntos.map((p) => new THREE.Vector3(...p)),
    false,
    'catmullrom',
    0.5,
  )
  return alta(
    new THREE.Mesh(new THREE.TubeGeometry(curva, 40, radio, 8), m),
    padre,
    0,
    0,
    0,
  )
}

// plano acostado sobre el piso
export function tapete(
  w: number,
  d: number,
  m: THREE.Material,
  x: number,
  z: number,
  y: number,
  padre: Padre,
) {
  const plano = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m)
  plano.rotation.x = -Math.PI / 2
  plano.position.set(x, y, z)
  plano.receiveShadow = true
  padre?.add(plano)
  return plano
}

// letrero plano con una o dos lineas de texto
export function letrero(
  ancho: number,
  alto: number,
  pixeles: [number, number],
  dibujar: Dibujo,
) {
  return new THREE.Mesh(
    new THREE.PlaneGeometry(ancho, alto),
    new THREE.MeshBasicMaterial({
      map: textura(pixeles[0], pixeles[1], dibujar),
    }),
  )
}

export function crearMateriales() {
  const tBanda = textura(
    128,
    128,
    (g, w, h) => {
      g.fillStyle = '#3f7d5c'
      g.fillRect(0, 0, w, h)
      g.strokeStyle = '#356d50'
      g.lineWidth = 3
      for (let y = -16; y < h + 16; y += 32) {
        for (const x of [20, 84]) {
          g.beginPath()
          g.moveTo(x, y)
          g.lineTo(x + 40, y + 16)
          g.lineTo(x, y + 32)
          g.stroke()
        }
      }
      g.fillStyle = '#356d50'
      g.fillRect(0, 0, 2, h)
    },
    [12, 1],
  )
  const tPerfil = textura(64, 64, (g, w, h) => {
    g.fillStyle = '#b9c0c6'
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#353b42'
    g.fillRect(0, 24, w, 16)
    g.fillStyle = '#868e96'
    g.fillRect(0, 21, w, 3)
    g.fillRect(0, 40, w, 3)
  })
  const tPerfilV = tPerfil.clone()
  tPerfilV.center.set(0.5, 0.5)
  tPerfilV.rotation = Math.PI / 2
  tPerfilV.needsUpdate = true
  // resplandor redondo para las lamparas y la torreta
  const tBrillo = textura(64, 64, (g) => {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    r.addColorStop(0, 'rgba(255,255,255,1)')
    r.addColorStop(0.25, 'rgba(255,255,255,.45)')
    r.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = r
    g.fillRect(0, 0, 64, 64)
  })

  const metal = { metalness: 1 }
  return {
    tBanda,
    tBrillo,
    alu: estandar(0xc3c9ce, { metalness: 0.9, roughness: 0.38 }),
    aluOsc: estandar(0x7d868e, { metalness: 0.85, roughness: 0.45 }),
    perfil: estandar(0xffffff, {
      metalness: 0.75,
      roughness: 0.42,
      map: tPerfil,
    }),
    perfilV: estandar(0xffffff, {
      metalness: 0.75,
      roughness: 0.42,
      map: tPerfilV,
    }),
    cromo: estandar(0xf2f4f6, { ...metal, roughness: 0.12 }),
    acero: estandar(0xaab1b8, { ...metal, roughness: 0.3 }),
    pieza: estandar(0xbcc3ca, { ...metal, roughness: 0.28 }),
    inox: estandar(0xe1e5e8, { ...metal, roughness: 0.2 }),
    laton: estandar(0xc9a44a, { ...metal, roughness: 0.3 }),
    negro: estandar(0x16191c, { roughness: 0.7 }),
    goma: estandar(0x1b1e22, { roughness: 0.9 }),
    gris: estandar(0x6c757d, { roughness: 0.7 }),
    grisClaro: estandar(0xc9ced2, { roughness: 0.65 }),
    panel: estandar(0x8d969d, { metalness: 0.4, roughness: 0.6 }),
    viga: estandar(0x39424a, { roughness: 0.7, metalness: 0.4 }),
    azul: estandar(0x2d6fb8, { roughness: 0.45 }),
    azulMotor: estandar(0x34587c, { metalness: 0.3, roughness: 0.5 }),
    azulSensor: estandar(0x1f66c7, { roughness: 0.4 }),
    azulOsc: estandar(0x1b2444, { roughness: 0.5 }),
    naranja: estandar(0xe59a14, { roughness: 0.5 }),
    amarillo: estandar(0xf2c21a, { roughness: 0.55 }),
    rojo: estandar(0xd32a22, { roughness: 0.4, metalness: 0.2 }),
    plastico: estandar(0x202327, { roughness: 0.42 }),
    carton: estandar(0xb98a56, { roughness: 0.9 }),
    madera: estandar(0xa9865a, { roughness: 0.95 }),
    manguera: estandar(0x2f84d8, { roughness: 0.35 }),
    mangueraAmarilla: estandar(0xf2c81e, { roughness: 0.4 }),
    cable: estandar(0x24282c, { roughness: 0.8 }),
    cristal: estandar(0x9fd2ea, {
      roughness: 0.15,
      transparent: true,
      opacity: 0.35,
    }),
  }
}

export type Materiales = ReturnType<typeof crearMateriales>
