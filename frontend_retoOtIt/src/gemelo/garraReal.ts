// En vivo, la garra (estación Amatrol, S7-300) repite lo que hace la real sin depender de
// que los pistones le dejen una pieza. No copia señal por señal (la real va más rápido que
// el modelo y se veía tomar sin soltar): cada vez que la pinza real cierra es un trabajo
// (material y carril), y la garra del gemelo lo hace completo con su propio movimiento,
// un poco después. Si en el depósito no hay pieza, se pone una.
//
// Lectura de los nodos (por su nombre; si alguno es otra cosa, solo se cambia aquí):
//   GRIP                 la pinza cierra: empieza un trabajo
//   CARRIAGE_EXTEND      el carro sale: ya se sabe a qué carril va
//   CANAL_OBJETIVO       carril al que va (1 a 4)
//   ALUMINIO_DETECTADO   la pieza es de aluminio
import type { NodoConocido } from './nodos'
import type { Tipo } from './planta'

const garra = (nodo: string): NodoConocido => ({ plc: 'S7-300', nodo })

export const NODOS_GARRA = {
  cerrar: garra('GRIP'),
  extender: garra('CARRIAGE_EXTEND'),
  canal: garra('CANAL_OBJETIVO'),
  aluminio: garra('ALUMINIO_DETECTADO'),
} satisfies Record<string, NodoConocido>

// Lo que hizo la garra real con una pieza. canal 0 = no se sabe (lo decide el gemelo).
export type Trabajo = { material: Tipo; canal: number }

// Si el gemelo se atrasa más que esto, los trabajos más viejos se descartan.
export const MAXIMO_TRABAJOS = 3

export type VigiaGarra = {
  cerraba: boolean
  extendia: boolean
  ultimo: Trabajo | null // aunque ya esté en curso, todavía puede recibir su carril
}

export const crearVigiaGarra = (): VigiaGarra => ({
  cerraba: false,
  extendia: false,
  ultimo: null,
})

// ¿Ya llegan datos de la garra? Hasta entonces, la garra sigue simulada.
export const hayDatosDeGarra = (valores: Record<string, number>) =>
  Object.values(NODOS_GARRA).some(({ nodo }) => valores[nodo] !== undefined)

const canalValido = (valor: number | undefined) => {
  const canal = Math.round(valor ?? 0)
  return canal >= 1 && canal <= 4 ? canal : 0
}

// Revisa los valores de ahora: agrega el trabajo nuevo y le pone carril cuando sale el carro.
export function vigilarGarra(
  v: VigiaGarra,
  valores: Record<string, number>,
  trabajos: Trabajo[],
) {
  const n = (clave: keyof typeof NODOS_GARRA) =>
    valores[NODOS_GARRA[clave].nodo]
  const cerrar = n('cerrar') === 1
  const extender = n('extender') === 1
  if (cerrar && !v.cerraba) {
    v.ultimo = {
      material: n('aluminio') === 1 ? 'al' : 'pl',
      canal: canalValido(n('canal')),
    }
    trabajos.push(v.ultimo)
    trabajos.splice(0, Math.max(0, trabajos.length - MAXIMO_TRABAJOS))
  }
  // el carril ya es seguro cuando el carro sale
  if (extender && !v.extendia && v.ultimo) {
    const canal = canalValido(n('canal'))
    if (canal) v.ultimo.canal = canal
  }
  v.cerraba = cerrar
  v.extendia = extender
}
