import { llamar } from '../login/apiPanel'

export type Parte = 'ok' | 'falla'
export type EstadoDatos = 'al_dia' | 'retrasado' | 'sin_datos' | 'desconocido'

export type VariableEstado = {
  plc: string
  variable: string
  ts: string
  segundosDesdeRecibida: number
}

export type EstadoSistema = {
  api: 'ok'
  baseDatosPanel: Parte
  baseDatosLecturas: Parte
  datos: EstadoDatos
  variables: VariableEstado[]
}

export type ResultadoEstado =
  | { ok: true; estado: EstadoSistema }
  | { ok: false; motivo: 'sesion' | 'fallo' }

const esParte = (v: unknown): v is Parte => v === 'ok' || v === 'falla'

function esVariable(valor: unknown): valor is VariableEstado {
  if (typeof valor !== 'object' || valor === null) return false
  const v = valor as Record<string, unknown>
  return (
    typeof v.plc === 'string' &&
    typeof v.variable === 'string' &&
    typeof v.ts === 'string' &&
    typeof v.segundosDesdeRecibida === 'number'
  )
}

function esEstado(valor: unknown): valor is EstadoSistema {
  if (typeof valor !== 'object' || valor === null) return false
  const e = valor as Record<string, unknown>
  return (
    e.api === 'ok' &&
    esParte(e.baseDatosPanel) &&
    esParte(e.baseDatosLecturas) &&
    (e.datos === 'al_dia' ||
      e.datos === 'retrasado' ||
      e.datos === 'sin_datos' ||
      e.datos === 'desconocido') &&
    Array.isArray(e.variables) &&
    e.variables.every(esVariable)
  )
}

export async function obtenerEstado(): Promise<ResultadoEstado> {
  try {
    const { estado, datos } = await llamar('GET', '/sistema/estado')
    if (estado === 401) return { ok: false, motivo: 'sesion' }
    if (estado !== 200 || !esEstado(datos))
      return { ok: false, motivo: 'fallo' }
    return { ok: true, estado: datos }
  } catch {
    return { ok: false, motivo: 'fallo' }
  }
}
