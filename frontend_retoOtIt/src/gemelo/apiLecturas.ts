import { leerCampo, llamar } from '../login/apiPanel'

// El valor más reciente de una variable de un PLC, como lo guarda la nube.
export type UltimaLectura = {
  plc: string
  variable: string
  valor: number
  ts: string
}

export type ResultadoLecturas =
  | { ok: true; lecturas: UltimaLectura[] }
  | { ok: false; motivo: 'sesion' | 'fallo' }

function esLectura(valor: unknown): valor is UltimaLectura {
  if (typeof valor !== 'object' || valor === null) return false
  const l = valor as Record<string, unknown>
  return (
    typeof l.plc === 'string' &&
    typeof l.variable === 'string' &&
    typeof l.valor === 'number' &&
    Number.isFinite(l.valor) &&
    typeof l.ts === 'string'
  )
}

export async function obtenerUltimasLecturas(): Promise<ResultadoLecturas> {
  try {
    const { estado, datos } = await llamar('GET', '/lecturas/ultimas')
    if (estado === 401) return { ok: false, motivo: 'sesion' }
    const lecturas = leerCampo(datos, 'lecturas')
    if (
      estado !== 200 ||
      !Array.isArray(lecturas) ||
      !lecturas.every(esLectura)
    ) {
      return { ok: false, motivo: 'fallo' }
    }
    return { ok: true, lecturas }
  } catch {
    return { ok: false, motivo: 'fallo' }
  }
}
