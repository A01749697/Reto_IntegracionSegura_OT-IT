// Etiquetas ancladas a puntos de la escena. Cada cuadro se acomodan para no taparse
// entre ellas ni quedar debajo de los paneles de la página.
import * as THREE from 'three'
import {
  ALTURA_MESA,
  BANDA_X1,
  X_ALMACEN,
  X_IDENTIFICACION,
  X_MARCADO,
  X_TOMA,
  Y_BANDA,
  Y_PIEZA,
  Z_BANDA,
  Z_PORTICO,
  type P3,
} from './medidas'
import { alturaPinza, type Planta } from './planta'
import type { SenalDigital, Senales } from './senales'

type Definicion = {
  texto: string
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
  return [
    { texto: 'Almacén de piezas', punto: [X_ALMACEN, Y_BANDA + 0.43, Z_BANDA] },
    {
      texto: 'Alimentador (PD-1)',
      punto: [-0.86, Y_PIEZA + 0.07, Z_BANDA],
      senal: 'yA',
    },
    {
      texto: 'Sensor de pieza (SC-1)',
      punto: [X_IDENTIFICACION, 0.44, Z_BANDA],
      senal: 'sc1',
    },
    { texto: 'Marcador (PS)', punto: [X_MARCADO, 0.6, Z_BANDA], senal: 'yC' },
    {
      texto: 'Banda y motor',
      punto: [BANDA_X1, 0.26, Z_BANDA - 0.25],
      senal: 'motorBanda',
    },
    { texto: 'Pórtico', punto: [0.93, 0.66, Z_PORTICO] },
    { texto: 'Carriles', punto: [0.86, 0.2, -0.05] },
    { texto: 'Cajas', punto: [0.86, 0.12, 0.3] },
    { texto: 'Tarima de producto', punto: [1.57, -0.62, 0.35] },
    { texto: 'PLC', punto: [-0.66, 0.34, -0.33] },
    { texto: 'Electroválvulas', punto: [-0.18, 0.21, -0.4] },
    { texto: 'Torreta', punto: [-0.93, 0.55, -0.41] },
    { texto: 'Botonera y paro de emergencia', punto: [-0.7, 0.14, 0.34] },
    { texto: 'Gabinete eléctrico', punto: [-1.62, 1.25, -0.77] },
    { texto: 'Pantalla del operador', punto: [-1.5, 0.62, 0.82] },
    // las de detalle van al final: las principales escogen lugar primero
    {
      texto: 'LS-1',
      punto: [-0.706, yLs, Z_BANDA + 0.075],
      senal: 'ls1',
      detalle: true,
    },
    {
      texto: 'LS-2',
      punto: [-0.541, yLs, Z_BANDA + 0.075],
      senal: 'ls2',
      detalle: true,
    },
    {
      texto: 'Sensor de metal (SI-1)',
      punto: [X_IDENTIFICACION, Y_PIEZA - 0.04, Z_BANDA - 0.13],
      senal: 'si1',
      detalle: true,
    },
    {
      texto: 'Sujeción (PD-2)',
      punto: [X_MARCADO, Y_PIEZA + 0.06, Z_BANDA - 0.2],
      senal: 'yB',
      detalle: true,
    },
    {
      texto: 'SC-2',
      punto: [X_MARCADO - 0.05, Y_PIEZA - 0.03, Z_BANDA + 0.13],
      senal: 'sc2',
      detalle: true,
    },
    {
      texto: 'LS-3',
      punto: [X_MARCADO + 0.06, Y_PIEZA - 0.07, Z_BANDA - 0.09],
      senal: 'ls3',
      detalle: true,
    },
    {
      texto: 'LS-4 tope',
      punto: [X_TOMA + 0.06, Y_PIEZA + 0.09, Z_BANDA],
      senal: 'ls4',
      detalle: true,
    },
    {
      texto: 'SI-2',
      punto: [X_TOMA - 0.1, 0.65, Z_PORTICO + 0.065],
      senal: 'si2',
      detalle: true,
    },
    {
      texto: 'Pinza',
      punto: () => [
        planta.carro.x + 0.04,
        alturaPinza(planta) + 0.01,
        Z_BANDA + 0.05,
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
    caja.textContent = definicion.texto
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
