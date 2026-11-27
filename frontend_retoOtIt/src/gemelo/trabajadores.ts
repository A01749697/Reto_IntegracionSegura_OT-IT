// Personal de la celda, en figuras sencillas con su equipo de seguridad: casco, chaleco
// reflejante, lentes y zapato de seguridad.
//   - Empacador: al final de la banda; cuando una caja se llena, la recoge.
//   - Operador: frente a la pantalla del pedestal.
import * as THREE from 'three'
import { cajaR, cil, estandar, textura } from './materiales'

type Brazo = { pivote: THREE.Group; codo: THREE.Group }

export type Trabajador = {
  grupo: THREE.Group
  torso: THREE.Group
  cabeza: THREE.Group
  brazos: [Brazo, Brazo]
}

function chaleco(color: string) {
  return textura(64, 64, (g, w, h) => {
    g.fillStyle = color
    g.fillRect(0, 0, w, h)
    // franjas reflejantes
    g.fillStyle = '#d9dde0'
    g.fillRect(0, h * 0.38, w, h * 0.09)
    g.fillRect(0, h * 0.62, w, h * 0.09)
  })
}

const PIEL = [0xc68b59, 0x8d5524, 0xe0ac69]

function trabajador(
  escena: THREE.Scene,
  x: number,
  z: number,
  giro: number,
  opciones: { chaleco: string; casco: number; pantalon: number; piel: number },
): Trabajador {
  const grupo = new THREE.Group()
  grupo.position.set(x, 0, z)
  grupo.rotation.y = giro
  escena.add(grupo)
  const piel = estandar(opciones.piel, { roughness: 0.7 })
  const pantalon = estandar(opciones.pantalon, { roughness: 0.85 })
  const camisa = estandar(0x5b6b7a, { roughness: 0.85 })
  const zapato = estandar(0x1d1f22, { roughness: 0.6 })
  const vest = estandar(0xffffff, {
    map: chaleco(opciones.chaleco),
    roughness: 0.75,
  })

  // piernas y zapatos
  for (const lado of [-1, 1]) {
    cil(0.062, 0.8, pantalon, lado * 0.085, 0.44, 0, 'y', grupo, 14)
    cajaR(0.1, 0.07, 0.2, zapato, lado * 0.085, 0.035, 0.035, grupo, 0.02)
  }
  // torso con chaleco; se mueve un poco al respirar
  const torso = new THREE.Group()
  torso.position.y = 0.86
  grupo.add(torso)
  cajaR(0.34, 0.56, 0.2, camisa, 0, 0.28, 0, torso, 0.06)
  cajaR(0.355, 0.42, 0.215, vest, 0, 0.31, 0, torso, 0.06)
  // cabeza: cuello, cara, lentes y casco
  const cabeza = new THREE.Group()
  cabeza.position.y = 0.62
  torso.add(cabeza)
  cil(0.045, 0.08, piel, 0, -0.02, 0, 'y', cabeza, 12)
  const cara = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 16), piel)
  cara.position.y = 0.1
  cara.castShadow = true
  cabeza.add(cara)
  cajaR(
    0.16,
    0.035,
    0.03,
    estandar(0x22282e, { roughness: 0.2 }),
    0,
    0.115,
    0.088,
    cabeza,
    0.01,
  )
  const casco = estandar(opciones.casco, { roughness: 0.35 })
  const copa = new THREE.Mesh(
    new THREE.SphereGeometry(0.115, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    casco,
  )
  copa.position.y = 0.15
  copa.castShadow = true
  cabeza.add(copa)
  cil(0.135, 0.012, casco, 0, 0.152, 0.015, 'y', cabeza, 24)

  // brazos con hombro y codo, para poder moverlos
  const brazos = [-1, 1].map((lado) => {
    const pivote = new THREE.Group()
    pivote.position.set(lado * 0.215, 0.5, 0)
    torso.add(pivote)
    cil(0.05, 0.3, vest, 0, -0.15, 0, 'y', pivote, 12)
    const codo = new THREE.Group()
    codo.position.y = -0.3
    pivote.add(codo)
    cil(0.043, 0.27, camisa, 0, -0.135, 0, 'y', codo, 12)
    const mano = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), piel)
    mano.position.y = -0.29
    codo.add(mano)
    return { pivote, codo }
  }) as [Brazo, Brazo]

  return { grupo, torso, cabeza, brazos }
}

export function crearTrabajadores(escena: THREE.Scene) {
  // al final de la banda, mirando hacia las cajas (en -x)
  const empacador = trabajador(escena, 1.17, 0.02, -Math.PI / 2 + 0.25, {
    chaleco: '#ff7a1a',
    casco: 0xf2c21a,
    pantalon: 0x2c3e5a,
    piel: PIEL[0],
  })
  // frente a la pantalla del pedestal (que mira hacia +z girada 0.5 rad)
  const operador = trabajador(escena, -1.27, 1.22, 0.5 + Math.PI, {
    chaleco: '#c6e82a',
    casco: 0xf4f6f7,
    pantalon: 0x3a3f46,
    piel: PIEL[1],
  })

  // t: segundos; recogiendo: el empacador está sacando una caja llena
  function animar(t: number, recogiendo: boolean) {
    for (const [i, p] of [empacador, operador].entries()) {
      p.torso.scale.y = 1 + Math.sin(t * 1.6 + i) * 0.006
      p.cabeza.rotation.y = Math.sin(t * 0.35 + i * 2) * 0.25
    }
    // empacador: brazos al frente cuando recoge; si no, un poco al costado
    const meta = recogiendo ? -1.2 : -0.15
    for (const [lado, brazo] of empacador.brazos.entries()) {
      const objetivo = meta + (recogiendo ? 0 : Math.sin(t * 0.8 + lado) * 0.05)
      brazo.pivote.rotation.x += (objetivo - brazo.pivote.rotation.x) * 0.08
      brazo.codo.rotation.x +=
        ((recogiendo ? -0.5 : -0.2) - brazo.codo.rotation.x) * 0.08
    }
    empacador.torso.rotation.x +=
      ((recogiendo ? 0.25 : 0) - empacador.torso.rotation.x) * 0.06
    // operador: teclea de vez en cuando en el panel
    const tecleando = Math.sin(t * 0.25) > 0.2
    for (const [lado, brazo] of operador.brazos.entries()) {
      const objetivo = tecleando
        ? -0.9 + Math.sin(t * 9 + lado * 2) * 0.06
        : -0.1
      brazo.pivote.rotation.x += (objetivo - brazo.pivote.rotation.x) * 0.08
      brazo.codo.rotation.x +=
        ((tecleando ? -0.7 : -0.15) - brazo.codo.rotation.x) * 0.08
    }
  }

  return { animar }
}
