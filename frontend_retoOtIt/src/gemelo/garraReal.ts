// En vivo, la garra (estación Amatrol, S7-300) sigue sus propias señales, sin depender de
// que los pistones le dejen una pieza. Si la garra real baja a tomar en el depósito y en el
// gemelo no hay pieza (la pusieron a mano o los pistones van desfasados), se pone una ahí.
//
// Lectura de los nodos (por su nombre; si alguno es otra cosa, solo se cambia aquí):
//   PICK_UP                    baja el eje Z (el cilindro de toma)
//   GRIP / RELEASE             cierra / abre la pinza (doble efecto: sin ninguna, se queda)
//   CARRIAGE_EXTEND            el carro sale hacia el carril
//   CARRIAGE_RETRACT           el carro regresa al depósito
//   CARRIAGE_FULLY_RETRACTED   el carro está en el depósito
//   CANAL_OBJETIVO             carril al que va (1 a 4)
//   ALUMINIO_DETECTADO         la pieza que toma es de aluminio
import type { NodoConocido } from './nodos'
import { ponerEnDeposito, type Planta, type Tipo } from './planta'
import type { Senales } from './senales'

const garra = (nodo: string): NodoConocido => ({ plc: 'S7-300', nodo })

export const NODOS_GARRA = {
  bajar: garra('PICK_UP'),
  cerrar: garra('GRIP'),
  abrir: garra('RELEASE'),
  extender: garra('CARRIAGE_EXTEND'),
  retraer: garra('CARRIAGE_RETRACT'),
  enCasa: garra('CARRIAGE_FULLY_RETRACTED'),
  canal: garra('CANAL_OBJETIVO'),
  aluminio: garra('ALUMINIO_DETECTADO'),
} satisfies Record<string, NodoConocido>

export type GarraReal = {
  pinza: boolean // cerrada
  destino: number // 0 = depósito, 1 a 4 = carril
  material: Tipo
  bajaba: boolean
  llevaba: boolean
}

export function crearGarraReal(): GarraReal {
  return {
    pinza: false,
    destino: 0,
    material: 'pl',
    bajaba: false,
    llevaba: false,
  }
}

// ¿Ya llegan datos de la garra? Hasta entonces, la garra sigue simulada.
export const hayDatosDeGarra = (valores: Record<string, number>) =>
  Object.values(NODOS_GARRA).some(({ nodo }) => valores[nodo] !== undefined)

export function seguirGarra(
  g: GarraReal,
  v: Record<string, number>,
  s: Senales,
  planta: Planta,
) {
  const n = (clave: keyof typeof NODOS_GARRA) => v[NODOS_GARRA[clave].nodo]
  const aluminio: Tipo = n('aluminio') === 1 ? 'al' : 'pl'

  // carro: regresa al depósito o sale a su carril
  if (n('enCasa') === 1 || n('retraer') === 1) g.destino = 0
  else if (n('extender') === 1) {
    const canal = Math.round(n('canal') ?? 0)
    if (canal >= 1 && canal <= 4) g.destino = canal
  }
  s.posX = g.destino

  // eje Z; al bajar en el depósito sin pieza, se pone una para que el ciclo se vea completo
  s.yZ = n('bajar') === 1
  if (s.yZ && !g.bajaba && g.destino === 0) ponerEnDeposito(planta, aluminio)
  g.bajaba = s.yZ

  // pinza (doble efecto)
  const cerrar = n('cerrar') === 1
  const abrir = n('abrir') === 1
  if (cerrar && !abrir && !g.pinza) {
    g.pinza = true
    g.material = aluminio
  } else if (abrir && !cerrar) g.pinza = false
  s.yG = g.pinza
  s.materialGarra = g.pinza ? g.material : ''

  // la pieza queda en su carril cuando la pinza abre lejos del depósito
  if (g.llevaba && !g.pinza && g.destino > 0) {
    if (g.material === 'al') s.piezasAl++
    else s.piezasPl++
  }
  g.llevaba = g.pinza

  // para la barra de pasos: 5 tomar, 6 clasificar
  s.pasoGarra = g.destino > 0 ? 6 : s.yZ || g.pinza ? 5 : 0
}
