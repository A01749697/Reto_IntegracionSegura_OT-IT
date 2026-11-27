// Arma la escena 3D, la mantiene al día con el gemelo y atiende la cámara.
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { construirCelda } from './celda'
import { crearEtiquetas, type Rect } from './etiquetas'
import { avanzarGemelo, type Gemelo } from './gemelo'
import { crearMateriales, prender } from './materiales'
import {
  ALTURA_MESA,
  BANDA,
  CAJA_Y,
  CAJAS,
  PARADAS_CARRO,
  PIEZAS_VISIBLES_ALMACEN,
  X_ALMACEN,
  Y_PIEZA,
  Z_LINEA,
} from './medidas'
import { construirNave } from './nave'
import type { SenalDigital } from './senales'
import { construirTablero } from './tablero'
import { crearTrabajadores } from './trabajadores'
import { VISTAS, type Vista } from './vistas'

type Opciones = {
  lienzo: HTMLCanvasElement
  capaEtiquetas: HTMLElement
  gemelo: Gemelo
  // Rectangulos de la pagina que tapan la vista, para no poner etiquetas debajo.
  obstaculos: () => DOMRect[]
  alRefrescar: () => void
}

// en el mismo orden que los focos de las tarjetas del PLC
const ENTRADAS: SenalDigital[] = [
  'ls1',
  'ls2',
  'ls3',
  'ls4',
  'sc1',
  'sc2',
  'si1',
  'si2',
  'si3',
  'b0',
  'c1',
  'z0',
  'z1',
  'xOk',
]
const SALIDAS: SenalDigital[] = [
  'yA',
  'yB',
  'yC',
  'yT',
  'yZ',
  'yG',
  'torreVerde',
  'torreAmarilla',
  'torreRoja',
]

const FONDO = 0x1c252d
const SEGUNDOS_REFRESCO = 0.1
const SEGUNDOS_VUELO = 0.9

function luces(escena: THREE.Scene) {
  escena.add(new THREE.HemisphereLight(0xe6edf3, 0x3a4148, 0.75))
  const sol = new THREE.DirectionalLight(0xffffff, 2.2)
  sol.position.set(2.2, 4.2, 2.6)
  sol.castShadow = true
  sol.shadow.mapSize.set(2048, 2048)
  Object.assign(sol.shadow.camera, {
    left: -3.2,
    right: 3.2,
    top: 3.2,
    bottom: -3.2,
    near: 0.5,
    far: 12,
  })
  sol.shadow.bias = -0.0004
  sol.shadow.normalBias = 0.01
  escena.add(sol)
  const relleno = new THREE.DirectionalLight(0x9fc4e0, 0.5)
  relleno.position.set(-3, 2, -1.5)
  escena.add(relleno)
}

// Libera la memoria de la tarjeta grafica al salir de la pantalla.
function liberar(escena: THREE.Scene) {
  escena.traverse((objeto) => {
    const { geometry, material } = objeto as THREE.Mesh
    geometry?.dispose()
    for (const m of [material ?? []].flat()) {
      for (const valor of Object.values(m)) {
        if (valor instanceof THREE.Texture) valor.dispose()
      }
      m.dispose()
    }
  })
}

// Lanza un error si el navegador no puede abrir WebGL.
export function crearEscena({
  lienzo,
  capaEtiquetas,
  gemelo,
  obstaculos,
  alRefrescar,
}: Opciones) {
  const { senales, planta } = gemelo

  const pintor = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true })
  pintor.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  pintor.shadowMap.enabled = true
  pintor.shadowMap.type = THREE.PCFSoftShadowMap
  pintor.toneMapping = THREE.ACESFilmicToneMapping
  pintor.toneMappingExposure = 1.05

  const escena = new THREE.Scene()
  escena.background = new THREE.Color(FONDO)
  escena.fog = new THREE.Fog(FONDO, 10, 30)
  const ambiente = new THREE.PMREMGenerator(pintor)
  const reflejos = ambiente.fromScene(new RoomEnvironment(), 0.04)
  escena.environment = reflejos.texture
  luces(escena)

  const camara = new THREE.PerspectiveCamera(38, 1, 0.05, 50)
  camara.position.set(...VISTAS.General.desde)
  const orbita = new OrbitControls(camara, lienzo)
  orbita.target.set(...VISTAS.General.hacia)
  orbita.enableDamping = true
  orbita.minDistance = 0.5
  orbita.maxDistance = 9
  orbita.maxPolarAngle = Math.PI * 0.495

  const m = crearMateriales()
  // en vivo, la pieza cuyo material todavía no se sabe
  const sinIdentificar = new THREE.MeshStandardMaterial({
    color: 0x8a9199,
    roughness: 0.7,
  })
  const nave = construirNave(escena, m)
  const trabajadores = crearTrabajadores(escena)
  let reloj = 0
  const mesa = new THREE.Group()
  mesa.position.y = ALTURA_MESA
  escena.add(mesa)
  const celda = construirCelda(escena, mesa, m)
  const tablero = construirTablero(mesa, m, celda.pistones)
  const etiquetas = crearEtiquetas(capaEtiquetas, planta)

  // Pone cada pieza de la escena donde dice el gemelo.
  function pintar() {
    const { pistones } = celda
    for (const clave of ['A', 'B', 'C', 'Z', 'T'] as const) {
      pistones[clave].vastago.position.x =
        planta.extension[clave] * pistones[clave].carrera
    }
    prender(pistones.B.leds[0], senales.b0)
    prender(pistones.B.leds[1], senales.ls3)
    prender(pistones.C.leds[1], senales.c1)
    prender(pistones.Z.leds[0], senales.z0)
    prender(pistones.Z.leds[1], senales.z1)
    for (const { dedo, lado } of pistones.Z.dedos)
      dedo.position.z = lado * (0.0375 - planta.carro.pinza * 0.009)

    celda.carro.position.x = planta.carro.x
    celda.acomodarCadena(planta.carro.x)
    celda.banderas.forEach((foco, i) =>
      prender(foco, Math.abs(planta.carro.x - PARADAS_CARRO[i]) < 0.004),
    )

    planta.cajas.forEach((caja, i) => {
      const { grupo, solapas } = celda.cajas[i]
      grupo.position.set(CAJAS[i].x + caja.avance, CAJA_Y, CAJAS[i].z)
      grupo.scale.setScalar(Math.max(0.001, caja.escala))
      for (const { pivote, lado } of solapas) {
        pivote.rotation.z =
          -lado * (Math.PI / 2) * (1 - caja.cierre) * 1.02 + lado * 0.02
      }
    })
    celda.tarima.lugares.forEach(({ bulto, cinta }, i) => {
      const tipo = planta.tarima[i]
      bulto.visible = tipo !== undefined
      if (tipo) cinta.material = celda.tarima.cintas[tipo]
    })

    planta.piezas.forEach((pieza, i) => {
      const { malla, marca, marcaPl } = celda.piezas[i]
      malla.material = !pieza.conocida
        ? sinIdentificar
        : pieza.tipo === 'al'
          ? m.pieza
          : m.plastico
      // cada material lleva su propio sello
      marca.visible = pieza.marcada && pieza.sello !== 'pl'
      marcaPl.visible = pieza.marcada && pieza.sello === 'pl'
      malla.visible = true
      malla.scale.setScalar(1)
      malla.rotation.set(0, 0, 0)
      if (pieza.estado === 'almacen') {
        malla.visible = pieza.fila < PIEZAS_VISIBLES_ALMACEN
        malla.position.set(
          X_ALMACEN,
          Y_PIEZA + (pieza.fila + planta.caida) * 0.05,
          Z_LINEA,
        )
      } else if (pieza.estado === 'caja') {
        const caja = planta.cajas[pieza.caja]
        const [dx, dy, dz] = pieza.destino
        malla.scale.setScalar(Math.max(0.001, caja.escala))
        malla.position.set(
          CAJAS[pieza.caja].x + caja.avance + dx * caja.escala,
          CAJA_Y + dy * caja.escala,
          CAJAS[pieza.caja].z + dz * caja.escala,
        )
      } else {
        malla.position.set(pieza.x, pieza.y, pieza.z)
        malla.rotation.x = pieza.giro
      }
    })

    for (const [clave, foco] of Object.entries(celda.focos))
      prender(foco, senales[clave as keyof typeof celda.focos])
    const { torreta, cpu } = tablero
    for (const [luz, encendida] of [
      [torreta.verde, senales.torreVerde],
      [torreta.amarilla, senales.torreAmarilla],
      [torreta.roja, senales.torreRoja],
    ] as const) {
      luz.lente.emissiveIntensity = encendida ? 2.6 : 0.05
      luz.halo.opacity = encendida ? 0.75 : 0
    }
    ;[
      senales.yA,
      senales.yB,
      senales.yC,
      senales.yZ,
      senales.yG,
      !senales.xOk,
    ].forEach((encendida, i) => prender(tablero.valvulas[i], encendida))
    ENTRADAS.forEach((clave, i) =>
      prender(tablero.entradas[i], senales[clave], 3),
    )
    SALIDAS.forEach((clave, i) =>
      prender(tablero.salidas[i], senales[clave], 3),
    )
    prender(cpu.alimentada, true)
    prender(cpu.corriendo, true)
    prender(cpu.detenida, false)
    prender(cpu.falla, false)
    tablero.aguja.rotation.z =
      Math.PI * 0.75 - (senales.presion / 10) * Math.PI * 1.5
  }

  // --- camara: vuelo suave hacia la vista elegida
  let vuelo: {
    t: number
    desde: THREE.Vector3
    hacia: THREE.Vector3
    desdeFinal: THREE.Vector3
    haciaFinal: THREE.Vector3
  } | null = null
  const cancelarVuelo = () => {
    vuelo = null
  }
  orbita.addEventListener('start', cancelarVuelo)

  // --- bucle de dibujo
  let ancho = 0
  let alto = 0
  function ajustarTamano() {
    const w = lienzo.clientWidth
    const h = lienzo.clientHeight
    if ((w === ancho && h === alto) || w === 0 || h === 0) return
    ancho = w
    alto = h
    pintor.setSize(w, h, false)
    camara.aspect = w / h
    camara.updateProjectionMatrix()
  }

  let tapados: Rect[] = []
  let ultimoTapados = 0
  function medirObstaculos(ahora: number) {
    if (ahora - ultimoTapados < 400) return
    ultimoTapados = ahora
    const origen = lienzo.getBoundingClientRect()
    tapados = obstaculos()
      .filter((r) => r.width > 0)
      .map((r) => [
        r.left - origen.left,
        r.top - origen.top,
        r.right - origen.left,
        r.bottom - origen.top,
      ])
  }

  let anterior = performance.now()
  let sinRefrescar = 0
  let cuadroPendiente = 0
  function cuadro(ahora: number) {
    const segundos = Math.min((ahora - anterior) / 1000, 0.1)
    anterior = ahora
    ajustarTamano()
    avanzarGemelo(gemelo, segundos)
    pintar()
    reloj += segundos
    // la banda avanza siempre; el desviador apunta a la caja de la última pieza
    const { banda } = celda
    banda.costillas.offset.x -=
      (BANDA.velocidad * segundos * banda.costillas.repeat.x) / banda.largo
    const giro = { al: 0.55, pl: -0.55 }[gemelo.planta.desvio ?? 'al'] ?? 0
    banda.desviador.rotation.y += (giro - banda.desviador.rotation.y) * 0.12
    trabajadores.animar(
      reloj,
      gemelo.planta.cajas.some(
        (c) => c.estado === 'saliendo' || c.estado === 'retiro',
      ),
    )

    if (vuelo) {
      vuelo.t = Math.min(1, vuelo.t + segundos / SEGUNDOS_VUELO)
      const k = vuelo.t * vuelo.t * (3 - 2 * vuelo.t)
      camara.position.lerpVectors(vuelo.desde, vuelo.desdeFinal, k)
      orbita.target.lerpVectors(vuelo.hacia, vuelo.haciaFinal, k)
      if (vuelo.t >= 1) vuelo = null
    }
    orbita.update()
    pintor.render(escena, camara)

    medirObstaculos(ahora)
    etiquetas.pintar(
      camara,
      camara.position.distanceTo(orbita.target) > 2.4,
      ancho,
      alto,
      senales,
      tapados,
    )

    sinRefrescar += segundos
    if (sinRefrescar > SEGUNDOS_REFRESCO) {
      sinRefrescar = 0
      nave.pintarPantalla(senales)
      alRefrescar()
    }
    cuadroPendiente = requestAnimationFrame(cuadro)
  }
  nave.pintarPantalla(senales)
  cuadroPendiente = requestAnimationFrame(cuadro)

  return {
    irAVista(vista: Vista) {
      vuelo = {
        t: 0,
        desde: camara.position.clone(),
        hacia: orbita.target.clone(),
        desdeFinal: new THREE.Vector3(...VISTAS[vista].desde),
        haciaFinal: new THREE.Vector3(...VISTAS[vista].hacia),
      }
    },
    mostrarEtiquetas: etiquetas.mostrar,
    destruir() {
      cancelAnimationFrame(cuadroPendiente)
      orbita.removeEventListener('start', cancelarVuelo)
      orbita.dispose()
      etiquetas.destruir()
      liberar(escena)
      reflejos.dispose()
      ambiente.dispose()
      pintor.dispose()
    },
  }
}

export type Escena = ReturnType<typeof crearEscena>
