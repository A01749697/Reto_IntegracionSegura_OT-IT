// En vivo, los pistones del gemelo no los mueve un PLC simulado: siguen a TAB_PASO, el paso
// real del S7-1516. La garra sigue simulada (en la celda su enlace es un TON y se ignora).
//
// El colector guarda TAB_PASO una vez por segundo, así que los pasos cortos a veces no
// quedan en el historian (de 3 salta a 5). Como la secuencia siempre va en el mismo orden,
// el seguidor pasa por los pasos que faltan, cada uno un momento, hasta alcanzar el real.
import { PASOS_DEL_SELLO, SELLO_POR_PASO } from './nodos'
import type { Tipo } from './planta'
import type { Senales } from './senales'

export type Seguidor = {
  paso: number | null // el paso del S7-1516 que el gemelo muestra ahora
  t: number // segundos en ese paso
  tope: boolean // el tope está abajo dejando pasar la pieza al depósito
  tTope: number
  // PD-1 afuera. Doble efecto: lo mueven TAB_EMPUJA_EXT / TAB_EMPUJA_RET (o el paso 2 / 3
  // si la salida no quedó en el historian) y se queda donde está sin ninguna de las dos.
  pd1: boolean
}

// Valores de TAB_EMPUJA_EXT y TAB_EMPUJA_RET (1 / 0), si llegan.
export type Empujador = { ext?: number; ret?: number }

// Lo menos que dura un paso en el gemelo cuando va alcanzando al real.
export const DURACION_MINIMA = 0.4
// En el paso 4 el pistón de apriete sale y regresa para que el capacitivo lo vea.
const PULSO_DETECCION = 0.3

// Paso real -> paso del gemelo (1 alimentar, 2 identificar, 3 sujetar y marcar, 4 depósito).
const PASO_GEMELO: Record<number, number> = {
  0: 0,
  1: 0,
  2: 1,
  3: 1,
  4: 2,
  5: 3,
  6: 3,
  7: 3,
  8: 4,
  9: 4,
}

export const esPasoConocido = (paso: number) => paso in PASO_GEMELO

export function crearSeguidor(): Seguidor {
  return { paso: null, t: 0, tope: false, tTope: 0, pd1: false }
}

// El paso que sigue en la secuencia, camino al objetivo.
//   0 → 1 → 2 → 3 → 4 → 5 → (6 o 7, según el sello) → 8 → 9 → 0
export function siguientePaso(
  paso: number,
  objetivo: number,
  material: Tipo | null,
): number {
  // paro o arranque a media secuencia: se va directo
  if ((objetivo === 0 || objetivo === 1) && paso !== 9 && paso !== 0)
    return objetivo
  switch (paso) {
    case 5:
      if (objetivo === 6 || objetivo === 7) return objetivo
      // el sello no quedó en el historian: se elige por el material, si se sabe
      return material ? PASOS_DEL_SELLO[material] : 8
    case 6:
    case 7:
      return 8
    case 9:
      return 0
    default:
      return paso + 1
  }
}

export function avanzarSeguidor(
  seg: Seguidor,
  objetivo: number | null,
  s: Senales,
  material: Tipo | null,
  dt: number,
  empujador: Empujador = {},
) {
  seg.t += dt
  const antes = seg.paso
  if (objetivo !== null && esPasoConocido(objetivo) && seg.paso !== objetivo) {
    if (seg.paso === null) {
      seg.paso = objetivo
      seg.t = 0
    } else if (seg.t >= DURACION_MINIMA) {
      seg.paso = siguientePaso(seg.paso, objetivo, material)
      seg.t = 0
    }
  }

  const paso = seg.paso
  // PD-1: lo que cambió al último (la salida o el paso) manda
  if (paso !== antes && paso === 2) seg.pd1 = true
  if (paso !== antes && paso === 3) seg.pd1 = false
  const { ext, ret } = empujador
  if (ext === 1 && ret !== 1) seg.pd1 = true
  else if (ret === 1 && ext !== 1) seg.pd1 = false
  // sin datos de las salidas, como siempre: el paso 2 es empujar
  s.yA = ext === undefined && ret === undefined ? paso === 2 : seg.pd1
  s.yB =
    paso === 5 ||
    paso === 6 ||
    paso === 7 ||
    (paso === 4 && seg.t < PULSO_DETECCION)
  s.yC = paso === 6 || paso === 7
  if (paso === 2) s.material = ''
  if (paso === 6 || paso === 7) s.material = SELLO_POR_PASO[paso]

  // 9: baja el tope; sube cuando la pieza ya salió del marcado
  if (paso === 9 && !seg.tope) {
    seg.tope = true
    seg.tTope = 0
  }
  if (seg.tope) {
    seg.tTope += dt
    if (seg.tTope > 0.45 && !s.sc2 && paso !== 9) seg.tope = false
  }
  s.yT = seg.tope

  s.paso = paso === null ? 0 : (PASO_GEMELO[paso] ?? 0)
  s.pasoReal = paso
}
