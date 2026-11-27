import type { UltimaLectura } from '../gemelo/apiLecturas'

// El tablero lee el S7-1516 (tablero neumático).
const PLC = 'S7-1500'

export type Valores = Record<string, number>

// Lo último que dijo la celda: el valor de cada nodo del S7-1516 y cuándo llegó.
export type Lecturas = {
  ahora: Valores
  ultimaCelda: number | null // ts (ms) de la lectura más reciente del S7-1516
  atraso: number | null // segundos desde esa lectura, al consultar
}

export function leerLecturas(
  lecturas: readonly UltimaLectura[],
  ahoraMs = Date.now(),
): Lecturas {
  const ahora: Valores = {}
  let ultimaCelda: number | null = null
  for (const l of lecturas) {
    const ms = Date.parse(l.ts)
    if (l.plc !== PLC || Number.isNaN(ms)) continue
    ahora[l.variable] = l.valor
    if (ultimaCelda === null || ms > ultimaCelda) ultimaCelda = ms
  }
  return {
    ahora,
    ultimaCelda,
    atraso:
      ultimaCelda === null
        ? null
        : Math.max(0, Math.round((ahoraMs - ultimaCelda) / 1000)),
  }
}
