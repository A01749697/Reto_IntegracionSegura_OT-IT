// Repite en el gemelo los cambios de los nodos del S7-1516 en el mismo orden y con el mismo
// ritmo con que pasaron, unos segundos después. Se consulta cada pocos segundos: si solo se
// mostrara el último valor, un pulso corto (un sello, un reset de 3 s) se perdería.
//
// Los relojes del PLC y del navegador no tienen que coincidir: el primer cambio que llega
// fija el desfase entre los dos y los siguientes guardan la distancia que tenían entre sí.
import type { Valores } from './estado'

// Segundos que la animación va detrás del primer cambio que llega. Tiene que cubrir el tiempo
// entre consultas, para que el siguiente lote llegue antes de que toque mostrarlo.
export const COLCHON = 4

// Si la animación queda más atrás o más adelante que esto (pestaña dormida, relojes que se
// mueven), se vuelve a anclar: lo atrasado se aplica de golpe en lugar de repetir minutos.
export const DESVIO_MAXIMO = 20

export type Cambio = { nodo: string; ts: string; valor: number }

type Evento = { t: number; nodo: string; valor: number } // t: reloj del gemelo (s)

export type Repeticion = {
  sembrada: boolean // ya se tomaron los valores de partida
  valores: Valores // lo que se está mostrando
  eventos: Evento[] // pendientes, en orden
  desfase: number | null // reloj del gemelo - reloj del PLC (s)
  ultimo: number | null // ts (ms) del cambio más nuevo recibido
  enUltimo: Set<string> // los que ya llegaron con ese mismo ts
}

export function crearRepeticion(): Repeticion {
  return {
    sembrada: false,
    valores: {},
    eventos: [],
    desfase: null,
    ultimo: null,
    enUltimo: new Set(),
  }
}

// Los valores de partida (la lectura más reciente de cada nodo) y hasta cuándo llegan.
export function sembrar(rep: Repeticion, valores: Valores, hastaMs: number) {
  rep.valores = { ...valores }
  rep.ultimo = hastaMs
  rep.enUltimo = new Set()
  rep.sembrada = true
}

// Desde dónde pedir la siguiente consulta (incluido: los repetidos se descartan aquí).
export const desdeParaConsulta = (rep: Repeticion): Date | null =>
  rep.ultimo === null ? null : new Date(rep.ultimo)

const clave = (c: { nodo: string; valor: number }) => `${c.nodo}=${c.valor}`

// Agrega los cambios de una consulta. ahora: reloj del gemelo, en segundos.
export function recibirCambios(
  rep: Repeticion,
  cambios: readonly Cambio[],
  ahora: number,
) {
  if (!rep.sembrada) return
  const nuevos = cambios
    .map((c) => ({ ms: Date.parse(c.ts), nodo: c.nodo, valor: c.valor }))
    .filter((c) => Number.isFinite(c.ms))
    .filter(
      (c) =>
        rep.ultimo === null ||
        c.ms > rep.ultimo ||
        (c.ms === rep.ultimo && !rep.enUltimo.has(clave(c))),
    )
    .sort((a, b) => a.ms - b.ms)
  if (nuevos.length === 0) return

  const masNuevo = nuevos[nuevos.length - 1].ms
  if (masNuevo !== rep.ultimo) rep.enUltimo = new Set()
  rep.ultimo = masNuevo
  for (const c of nuevos) if (c.ms === masNuevo) rep.enUltimo.add(clave(c))

  if (rep.desfase === null) rep.desfase = ahora + COLCHON - nuevos[0].ms / 1000
  for (const { ms, nodo, valor } of nuevos)
    rep.eventos.push({ t: ms / 1000 + rep.desfase, nodo, valor })
  rep.eventos.sort((a, b) => a.t - b.t)

  // si el más nuevo quedó demasiado lejos, se reancla
  const lejania = rep.eventos[rep.eventos.length - 1].t - (ahora + COLCHON)
  if (Math.abs(lejania) > DESVIO_MAXIMO) {
    rep.desfase -= lejania
    for (const evento of rep.eventos) evento.t -= lejania
  }
}

// Aplica lo que ya toca mostrar y devuelve los valores de ahora.
export function valoresEn(rep: Repeticion, ahora: number): Valores {
  while (rep.eventos.length > 0 && rep.eventos[0].t <= ahora) {
    const { nodo, valor } = rep.eventos.shift() as Evento
    rep.valores[nodo] = valor
  }
  return rep.valores
}
