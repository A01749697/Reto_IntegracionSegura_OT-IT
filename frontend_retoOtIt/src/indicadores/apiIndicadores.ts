import { leerCampo, llamar } from '../login/apiPanel'

// Un tramo (hora o día) como lo calcula el panel con el historian del S7-1516.
export type Tramo = {
  inicio: string
  aluminio: number
  plastico: number
  marcha: number // segundos con la torreta en verde
  mantenimiento: number // segundos en mantenimiento (paro planeado)
  paro: number // segundos en paro, falla o reset, con la celda mandando datos
  sinRegistro: number // segundos sin ningún dato
  paros: number
  fallas: number
  ciclos: number
  segundosCiclo: number
}

export type Cubeta = 'hora' | 'dia'

// Cada vez que se activó TAB_FALLA, con el código que tenía TAB_COD_FALLA.
export type EventoFalla = { ts: string; codigo: number | null }

export type ResultadoIndicadores =
  | { ok: true; tramos: Tramo[]; fallas: EventoFalla[]; truncado: boolean }
  | { ok: false; motivo: 'sesion' | 'fallo' }

const NUMEROS = [
  'aluminio',
  'plastico',
  'marcha',
  'mantenimiento',
  'paro',
  'sinRegistro',
  'paros',
  'fallas',
  'ciclos',
  'segundosCiclo',
] as const

function esEventoFalla(valor: unknown): valor is EventoFalla {
  if (typeof valor !== 'object' || valor === null) return false
  const f = valor as Record<string, unknown>
  return (
    typeof f.ts === 'string' &&
    (f.codigo === null ||
      (typeof f.codigo === 'number' && Number.isFinite(f.codigo)))
  )
}

function esTramo(valor: unknown): valor is Tramo {
  if (typeof valor !== 'object' || valor === null) return false
  const t = valor as Record<string, unknown>
  return (
    typeof t.inicio === 'string' &&
    NUMEROS.every((c) => typeof t[c] === 'number' && Number.isFinite(t[c]))
  )
}

export async function obtenerIndicadores(
  desde: Date,
  hasta: Date,
  cubeta: Cubeta,
): Promise<ResultadoIndicadores> {
  const consulta = new URLSearchParams({
    desde: desde.toISOString(),
    hasta: hasta.toISOString(),
    cubeta,
  })
  try {
    const { estado, datos } = await llamar(
      'GET',
      `/lecturas/indicadores?${consulta.toString()}`,
    )
    if (estado === 401) return { ok: false, motivo: 'sesion' }
    const tramos = leerCampo(datos, 'cubetas')
    const fallas = leerCampo(datos, 'fallas') ?? []
    if (
      estado !== 200 ||
      !Array.isArray(tramos) ||
      !tramos.every(esTramo) ||
      !Array.isArray(fallas) ||
      !fallas.every(esEventoFalla)
    )
      return { ok: false, motivo: 'fallo' }
    return {
      ok: true,
      tramos,
      fallas,
      truncado: leerCampo(datos, 'truncado') === true,
    }
  } catch {
    return { ok: false, motivo: 'fallo' }
  }
}
