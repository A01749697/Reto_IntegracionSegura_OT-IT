import { leerCampo, llamar } from '../login/apiPanel'

// Un tramo (hora o día) como lo calcula el panel con el historian del S7-1516.
export type Tramo = {
  inicio: string
  aluminio: number
  plastico: number
  marcha: number // segundos con la torreta en verde
  paro: number // segundos en otro estado, con la celda mandando datos
  sinRegistro: number // segundos sin ningún dato
  paros: number
  ciclos: number
  segundosCiclo: number
}

export type Cubeta = 'hora' | 'dia'

export type ResultadoIndicadores =
  | { ok: true; tramos: Tramo[]; truncado: boolean }
  | { ok: false; motivo: 'sesion' | 'fallo' }

const NUMEROS = [
  'aluminio',
  'plastico',
  'marcha',
  'paro',
  'sinRegistro',
  'paros',
  'ciclos',
  'segundosCiclo',
] as const

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
    if (estado !== 200 || !Array.isArray(tramos) || !tramos.every(esTramo))
      return { ok: false, motivo: 'fallo' }
    return { ok: true, tramos, truncado: leerCampo(datos, 'truncado') === true }
  } catch {
    return { ok: false, motivo: 'fallo' }
  }
}
