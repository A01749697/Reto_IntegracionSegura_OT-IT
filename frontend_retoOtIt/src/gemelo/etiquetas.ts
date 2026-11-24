// Etiquetas ancladas a puntos de la escena (el texto sale del idioma activo al crearlas). Cada cuadro se acomodan para no taparse
// entre ellas ni quedar debajo de los paneles de la página.
import * as THREE from 'three'
import i18n from '../idioma/i18n'
import {
  ALTURA_MESA,
  GUIA_X0,
  X_ALMACEN,
  X_IDENTIFICACION,
  X_MARCADO,
  X_TOMA,
  X_TOPE,
  Y_GUIA,
  Y_PIEZA,
  Y_PIEZA_TOMA,
  yPiezaEn,
  Z_LINEA,
  Z_PORTICO,
  type P3,
} from './medidas'
import { alturaPinza, type Planta } from './planta'
import type { SenalDigital, Senales } from './senales'

export type ClaveEtiqueta =
  | 'almacen'
  | 'alimentador'
  | 'sensorPieza'
  | 'marcador'
  | 'guia'
  | 'deposito'
  | 'tope'
  | 'portico'
  | 'carriles'
  | 'cajas'
  | 'tarima'
  | 'plc'
  | 'electrovalvulas'
  | 'torreta'
  | 'gabinete'
  | 'pantalla'
  | 'ls1'
  | 'ls2'
  | 'sensorMetal'
  | 'sujecion'
  | 'sc2'
  | 'ls3'
  | 'ls4'
  | 'si2'
  | 'si3'
  | 'pinza'

type Definicion = {
  clave: ClaveEtiqueta // el texto está en los diccionarios de idioma (gemelo.escena.etiquetas)
  punto: P3 | (() => P3)
  senal?: SenalDigital // se resalta cuando la señal esta encendida
  detalle?: boolean // solo se ve con la camara cerca
}

// [izquierda, arriba, derecha, abajo] en pixeles de la vista
export type Rect = [number, number, number, number]

const CLASE_ETIQUETA =
  'absolute top-0 left-0 rounded-sm border border-l-2 border-linea border-l-acento bg-fondo/90 px-[7px] py-1 text-[11px] leading-none font-medium whitespace-nowrap text-texto will-change-transform data-[activa=true]:border-l-ok'
const CLASE_LINEA =
  'fill-none stroke-acento stroke-[1.2] opacity-85 data-[activa=true]:stroke-ok'

// lugares donde puede ir la etiqueta respecto a su punto: [lado, desplazamiento vertical]
const LUGARES = [
  [1, -28],
  [-1, -28],
  [1, 12],
  [-1, 12],
  [1, -58],
  [-1, -58],
  [1, 42],
  [-1, 42],
  [1, -90],
  [-1, -90],
  [1, 74],
  [-1, 74],
]

const seEnciman = (a: Rect, b: Rect) =>
  a[0] < b[2] + 5 && a[2] > b[0] - 5 && a[1] < b[3] + 4 && a[3] > b[1] - 4

function definiciones(planta: Planta): Definicion[] {
  const yLs = Y_PIEZA - 0.06
  const yI = yPiezaEn(X_IDENTIFICACION)
  const yM = yPiezaEn(X_MARCADO)
  return [
    { clave: 'almacen', punto: [X_ALMACEN, Y_GUIA + 0.43, Z_LINEA] },
    {
      clave: 'alimentador',
      punto: [-0.86, Y_PIEZA + 0.07, Z_LINEA],
      senal: 'yA',
    },
    {
      clave: 'sensorPieza',
      punto: [X_IDENTIFICACION, yI + 0.22, Z_LINEA],
      senal: 'sc1',
    },
    { clave: 'marcador', punto: [X_MARCADO, yM + 0.38, Z_LINEA], senal: 'yC' },
    { clave: 'guia', punto: [GUIA_X0 + 0.42, yI - 0.03, Z_LINEA + 0.06] },
    {
      clave: 'deposito',
      punto: [X_TOMA, Y_PIEZA_TOMA + 0.05, Z_LINEA + 0.05],
      senal: 'ls4',
    },
    { clave: 'portico', punto: [0.93, 0.66, Z_PORTICO] },
    { clave: 'carriles', punto: [0.86, 0.2, -0.05] },
    { clave: 'cajas', punto: [0.86, 0.12, 0.3] },
    { clave: 'tarima', punto: [1.57, -0.62, 0.35] },
    { clave: 'plc', punto: [-0.66, 0.34, -0.33] },
    { clave: 'electrovalvulas', punto: [-0.18, 0.21, -0.4] },
    { clave: 'torreta', punto: [-0.93, 0.55, -0.41] },
    { clave: 'gabinete', punto: [-1.62, 1.25, -0.77] },
    { clave: 'pantalla', punto: [-1.5, 0.62, 0.82] },
    // las de detalle van al final: las principales escogen lugar primero
    {
      clave: 'ls1',
      punto: [-0.706, yLs, Z_LINEA + 0.075],
      senal: 'ls1',
      detalle: true,
    },
    {
      clave: 'ls2',
      punto: [-0.541, yLs, Z_LINEA + 0.075],
      senal: 'ls2',
      detalle: true,
    },
    {
      clave: 'sensorMetal',
      punto: [X_IDENTIFICACION, yI - 0.04, Z_LINEA - 0.13],
      senal: 'si1',
      detalle: true,
    },
    {
      clave: 'sujecion',
      punto: [X_MARCADO, yM + 0.06, Z_LINEA - 0.2],
      senal: 'yB',
      detalle: true,
    },
    {
      clave: 'sc2',
      punto: [X_MARCADO - 0.05, yM - 0.03, Z_LINEA + 0.13],
      senal: 'sc2',
      detalle: true,
    },
    {
      clave: 'tope',
      punto: [X_TOPE + 0.02, yM - 0.06, Z_LINEA + 0.05],
      senal: 'yT',
      detalle: true,
    },
    {
      clave: 'ls3',
      punto: [X_MARCADO + 0.06, yM - 0.07, Z_LINEA - 0.09],
      senal: 'ls3',
      detalle: true,
    },
    {
      clave: 'ls4',
      punto: [X_TOMA + 0.06, Y_PIEZA_TOMA + 0.09, Z_LINEA],
      senal: 'ls4',
      detalle: true,
    },
    {
      clave: 'si3',
      punto: [X_TOMA, Y_PIEZA_TOMA - 0.03, Z_LINEA + 0.12],
      senal: 'si3',
      detalle: true,
    },
    {
      clave: 'si2',
      punto: [X_TOMA - 0.1, 0.65, Z_PORTICO + 0.065],
      senal: 'si2',
      detalle: true,
    },
    {
      clave: 'pinza',
      punto: () => [
        planta.carro.x + 0.04,
        alturaPinza(planta) + 0.01,
        Z_LINEA + 0.05,
      ],
      senal: 'yG',
      detalle: true,
    },
  ]
}

export function crearEtiquetas(capa: HTMLElement, planta: Planta) {
  const SVG = 'http://www.w3.org/2000/svg'
  const lineas = document.createElementNS(SVG, 'svg')
  lineas.setAttribute('aria-hidden', 'true')
  lineas.setAttribute('class', 'absolute inset-0 h-full w-full')
  capa.appendChild(lineas)

  const etiquetas = definiciones(planta).map((definicion) => {
    const caja = document.createElement('div')
    caja.className = CLASE_ETIQUETA
    caja.textContent = i18n.t(`gemelo.escena.etiquetas.${definicion.clave}`)
    capa.appendChild(caja)
    const linea = document.createElementNS(SVG, 'path')
    linea.setAttribute('class', CLASE_LINEA)
    lineas.appendChild(linea)
    return {
      ...definicion,
      caja,
      linea,
      ancho: 0,
      alto: 0,
      lugar: -1,
      posicion: new THREE.Vector3(),
    }
  })

  function medir() {
    for (const e of etiquetas) {
      e.caja.style.display = ''
      e.ancho = e.caja.offsetWidth
      e.alto = e.caja.offsetHeight
    }
  }
  medir()
  // con la fuente ya cargada el ancho cambia
  document.fonts?.ready.then(medir).catch(() => {})

  const proyectado = new THREE.Vector3()

  function pintar(
    camara: THREE.Camera,
    lejos: boolean,
    ancho: number,
    alto: number,
    senales: Senales,
    obstaculos: Rect[],
  ) {
    const ocupado = obstaculos.slice()
    for (const e of etiquetas) {
      const punto = typeof e.punto === 'function' ? e.punto() : e.punto
      e.posicion.set(punto[0], punto[1] + ALTURA_MESA, punto[2])
      proyectado.copy(e.posicion).project(camara)
      const x = ((proyectado.x + 1) / 2) * ancho
      const y = ((1 - proyectado.y) / 2) * alto
      const enVista =
        proyectado.z < 1 &&
        Math.abs(proyectado.x) < 1 &&
        Math.abs(proyectado.y) < 1 &&
        !(e.detalle && lejos)

      let lugar: Rect | null = null
      if (enVista) {
        // primero el lugar anterior, para que no brinque
        const orden =
          e.lugar >= 0 ? [e.lugar, ...LUGARES.keys()] : LUGARES.keys()
        for (const i of orden) {
          const [lado, dy] = LUGARES[i]
          const izquierda = lado > 0 ? x + 20 : x - 20 - e.ancho
          const r: Rect = [
            izquierda,
            y + dy,
            izquierda + e.ancho,
            y + dy + e.alto,
          ]
          const cabe =
            r[0] >= 4 && r[1] >= 4 && r[2] <= ancho - 4 && r[3] <= alto - 4
          if (!cabe || ocupado.some((o) => seEnciman(r, o))) continue
          lugar = r
          e.lugar = i
          break
        }
      }

      const visible = lugar ? '' : 'none'
      e.caja.style.display = visible
      e.linea.style.display = visible
      if (!lugar) continue
      ocupado.push(lugar, [x - 4, y - 4, x + 4, y + 4])
      e.caja.style.transform = `translate(${lugar[0].toFixed(1)}px,${lugar[1].toFixed(1)}px)`
      const xLinea = lugar[0] > x ? lugar[0] : lugar[2]
      const yLinea = (lugar[1] + lugar[3]) / 2
      // la linea termina en un circulo sobre el punto
      e.linea.setAttribute(
        'd',
        `M${x.toFixed(1)} ${y.toFixed(1)} L${xLinea.toFixed(1)} ${yLinea.toFixed(1)} ` +
          `M${(x - 2.5).toFixed(1)} ${y.toFixed(1)} a2.5 2.5 0 1 0 5 0 a2.5 2.5 0 1 0 -5 0`,
      )
      const activa = String(e.senal !== undefined && senales[e.senal])
      e.caja.dataset.activa = activa
      e.linea.dataset.activa = activa
    }
  }

  return {
    pintar,
    mostrar(visibles: boolean) {
      capa.style.visibility = visibles ? '' : 'hidden'
    },
    destruir() {
      capa.replaceChildren()
      capa.style.visibility = ''
    },
  }
}
