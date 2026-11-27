// Banda de salida y estación de empaque (solo el dibujo; el movimiento está en planta.ts).
// Los carriles sueltan sus piezas a la banda; al final, un desviador manda cada una a la
// caja de su material, que está sobre una mesa de acero inoxidable.
import * as THREE from 'three'
import { BANDA, CAJAS } from './medidas'
import {
  caja,
  cajaR,
  cil,
  estandar,
  textura,
  type Materiales,
} from './materiales'

type Grupo = THREE.Group

export function construirBanda(E: Grupo, m: Materiales) {
  const largo = BANDA.x1 - BANDA.x0
  const centro = (BANDA.x0 + BANDA.x1) / 2
  const y = BANDA.y

  // la banda: hule negro con costillas, la textura se mueve para que se vea avanzar
  const costillas = textura(
    128,
    32,
    (g, w, h) => {
      g.fillStyle = '#23272b'
      g.fillRect(0, 0, w, h)
      g.fillStyle = '#33393f'
      for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 5, h)
    },
    [Math.round(largo / 0.03), 1],
  )
  const hule = estandar(0xffffff, { map: costillas, roughness: 0.85 })
  caja(largo, 0.006, BANDA.ancho, hule, centro, y - 0.003, BANDA.z, E)

  // marco de aluminio con guardas amarillas a los lados
  const amarillo = estandar(0xf2c21a, { roughness: 0.5 })
  for (const lado of [-1, 1]) {
    const z = BANDA.z + lado * (BANDA.ancho / 2 + 0.006)
    caja(largo + 0.05, 0.03, 0.008, m.aluOsc, centro, y - 0.012, z, E)
    caja(largo + 0.03, 0.012, 0.004, amarillo, centro, y + 0.01, z, E)
  }
  // rodillos de los extremos y motor
  for (const x of [BANDA.x0 - 0.012, BANDA.x1 + 0.012])
    cil(0.016, BANDA.ancho + 0.01, m.acero, x, y - 0.016, BANDA.z, 'z', E, 16)
  const motor = estandar(0x2f6fb3, { roughness: 0.45, metalness: 0.3 })
  cil(
    0.022,
    0.07,
    motor,
    BANDA.x0 - 0.012,
    y - 0.02,
    BANDA.z - 0.08,
    'z',
    E,
    18,
  )
  caja(
    0.04,
    0.04,
    0.03,
    m.negro,
    BANDA.x0 - 0.012,
    y - 0.02,
    BANDA.z - 0.125,
    E,
  )
  // patas
  for (const x of [BANDA.x0 + 0.01, BANDA.x1 - 0.01])
    for (const lado of [-1, 1])
      caja(
        0.018,
        y - 0.025,
        0.018,
        m.aluOsc,
        x,
        (y - 0.025) / 2,
        BANDA.z + lado * (BANDA.ancho / 2 + 0.006),
        E,
      )

  // mesa de empaque de acero inoxidable, con tope al fondo
  const inox = estandar(0xc9cfd4, { roughness: 0.3, metalness: 0.85 })
  const desde = CAJAS[0].z - 0.1
  const hasta = CAJAS[1].z + 0.1
  caja(
    0.17,
    0.004,
    hasta - desde,
    inox,
    CAJAS[0].x,
    0.002,
    (desde + hasta) / 2,
    E,
  )

  // desviador: una paleta que gira hacia la caja que le toca a la pieza
  const desviador = new THREE.Group()
  desviador.position.set(BANDA.x1 + 0.02, y + 0.012, BANDA.z)
  E.add(desviador)
  caja(
    0.07,
    0.022,
    0.006,
    estandar(0xe0462d, { roughness: 0.5 }),
    0.035,
    0,
    0,
    desviador,
  )
  cajaR(0.03, 0.035, 0.03, m.aluOsc, 0, 0.006, 0, desviador, 0.004)

  return { costillas, desviador, largo }
}

export type Banda = ReturnType<typeof construirBanda>
