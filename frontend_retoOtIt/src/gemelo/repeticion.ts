// Repite en el gemelo los cambios de TAB_PASO con el mismo ritmo con que pasaron en la celda,
// unos segundos después. El panel solo consulta cada pocos segundos: si se mostrara el último
// valor, la barra de pasos saltaría. Así se ve cada paso, en orden y con su duración real.
//
// No hace falta que el reloj del PLC y el del navegador coincidan: el primer cambio nuevo
// fija el desfase entre los dos y los siguientes guardan la distancia que tenían entre sí.

// Segundos que la animación va detrás de la llegada del primer cambio. Tiene que cubrir el
// tiempo entre consultas, para que el siguiente cambio llegue antes de que toque mostrarlo.
export const COLCHON = 7

// Si la animación queda más atrás o más adelante que esto (pestaña dormida, relojes que se
// mueven), se vuelve a anclar en lugar de reproducir minutos de historia.
const DESVIO_MAXIMO = 20

type Evento = { t: number; paso: number } // t: segundos en el reloj del gemelo

// Otros nodos que se repiten con el mismo desfase que el paso (las salidas del empujador).
type EventoNodo = { t: number; nodo: string; valor: number }
type Avance = { ultimo: number | null; iniciada: boolean }

export type Repeticion = {
  otros: Record<string, Avance>
  eventosOtros: EventoNodo[]
  valores: Record<string, number> // último valor mostrado de cada uno de esos nodos
  eventos: Evento[] // pendientes de mostrar, en orden
  desfase: number | null // reloj del gemelo - reloj del PLC (segundos)
  ultimo: number | null // ts_plc (ms) del cambio más nuevo que ya se recibió
  paso: number | null // el paso que toca mostrar ahora
  iniciada: boolean
}

export function crearRepeticion(): Repeticion {
  return {
    otros: {},
    eventosOtros: [],
    valores: {},
    eventos: [],
    desfase: null,
    ultimo: null,
    paso: null,
    iniciada: false,
  }
}

export type PuntoPaso = { ts: string; valor: number }

// Agrega los cambios que llegaron en una consulta. ahora: reloj del gemelo, en segundos.
export function recibirPasos(
  rep: Repeticion,
  puntos: readonly PuntoPaso[],
  ahora: number,
) {
  const nuevos = puntos
    .map((p) => ({ ms: Date.parse(p.ts), paso: Math.round(p.valor) }))
    .filter(
      (e) =>
        Number.isFinite(e.ms) && (rep.ultimo === null || e.ms > rep.ultimo),
    )
    .sort((a, b) => a.ms - b.ms)

  if (nuevos.length === 0) {
    rep.iniciada = true
    return
  }
  rep.ultimo = nuevos[nuevos.length - 1].ms

  // la primera consulta trae historia vieja: solo importa en qué paso quedó
  if (!rep.iniciada) {
    rep.iniciada = true
    rep.paso = nuevos[nuevos.length - 1].paso
    return
  }

  if (rep.desfase === null) rep.desfase = ahora + COLCHON - nuevos[0].ms / 1000
  for (const { ms, paso } of nuevos)
    rep.eventos.push({ t: ms / 1000 + rep.desfase, paso })

  reanclar(rep, ahora)
}

// Si el más nuevo quedó demasiado lejos (en el futuro o en el pasado), se reancla todo.
function reanclar(rep: Repeticion, ahora: number) {
  const ultimos = [rep.eventos.at(-1)?.t, rep.eventosOtros.at(-1)?.t].filter(
    (t): t is number => t !== undefined,
  )
  if (ultimos.length === 0 || rep.desfase === null) return
  const lejania = Math.max(...ultimos) - (ahora + COLCHON)
  if (Math.abs(lejania) <= DESVIO_MAXIMO) return
  rep.desfase -= lejania
  for (const evento of rep.eventos) evento.t -= lejania
  for (const evento of rep.eventosOtros) evento.t -= lejania
}

// Lo mismo que recibirPasos, para otro nodo (comparte el desfase con el paso).
export function recibirNodo(
  rep: Repeticion,
  nodo: string,
  puntos: readonly PuntoPaso[],
  ahora: number,
) {
  const avance = (rep.otros[nodo] ??= { ultimo: null, iniciada: false })
  const nuevos = puntos
    .map((p) => ({ ms: Date.parse(p.ts), valor: p.valor }))
    .filter(
      (e) =>
        Number.isFinite(e.ms) &&
        (avance.ultimo === null || e.ms > avance.ultimo),
    )
    .sort((a, b) => a.ms - b.ms)
  if (nuevos.length === 0) {
    avance.iniciada = true
    return
  }
  avance.ultimo = nuevos[nuevos.length - 1].ms
  if (!avance.iniciada) {
    avance.iniciada = true
    rep.valores[nodo] = nuevos[nuevos.length - 1].valor
    return
  }
  if (rep.desfase === null) rep.desfase = ahora + COLCHON - nuevos[0].ms / 1000
  const desfase = rep.desfase
  for (const { ms, valor } of nuevos)
    rep.eventosOtros.push({ t: ms / 1000 + desfase, nodo, valor })
  rep.eventosOtros.sort((a, b) => a.t - b.t)
  reanclar(rep, ahora)
}

// Los valores de esos otros nodos que tocan mostrar ahora.
export function valoresEn(
  rep: Repeticion,
  ahora: number,
): Record<string, number> {
  while (rep.eventosOtros.length > 0 && rep.eventosOtros[0].t <= ahora) {
    const { nodo, valor } = rep.eventosOtros.shift() as EventoNodo
    rep.valores[nodo] = valor
  }
  return rep.valores
}

// El paso que toca mostrar en este momento.
export function pasoEn(rep: Repeticion, ahora: number): number | null {
  while (rep.eventos.length > 0 && rep.eventos[0].t <= ahora)
    rep.paso = (rep.eventos.shift() as Evento).paso
  return rep.paso
}
