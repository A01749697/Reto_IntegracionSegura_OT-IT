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

export type VentanaDisponibilidad = '24h' | '7d'
export type EstadoCubeta =
  'con_datos' | 'sin_datos' | 'sin_historial' | 'en_curso'

export type CubetaDisponibilidad = {
  inicio: string
  lecturas: number
  estado: EstadoCubeta
}

export type CorteDisponibilidad = {
  desde: string
  hasta: string
  enCurso: boolean
}

export type Disponibilidad = {
  ventana: VentanaDisponibilidad
  cubetaSegundos: number
  hasta: string
  cubetas: CubetaDisponibilidad[]
  resumen: {
    porcentaje: number | null
    cubetasEvaluadas: number
    cubetasConDatos: number
    interrupciones: number
    mayorCorteSegundos: number
  }
  cortes: CorteDisponibilidad[]
}

export type ResultadoDisponibilidad =
  | { ok: true; disponibilidad: Disponibilidad }
  | { ok: false; motivo: 'sesion' | 'fallo' }

const ESTADOS_CUBETA: readonly unknown[] = [
  'con_datos',
  'sin_datos',
  'sin_historial',
  'en_curso',
]

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function esCubeta(valor: unknown): valor is CubetaDisponibilidad {
  return (
    esObjeto(valor) &&
    typeof valor.inicio === 'string' &&
    typeof valor.lecturas === 'number' &&
    ESTADOS_CUBETA.includes(valor.estado)
  )
}

function esCorte(valor: unknown): valor is CorteDisponibilidad {
  return (
    esObjeto(valor) &&
    typeof valor.desde === 'string' &&
    typeof valor.hasta === 'string' &&
    typeof valor.enCurso === 'boolean'
  )
}

function esResumen(valor: unknown): valor is Disponibilidad['resumen'] {
  return (
    esObjeto(valor) &&
    (valor.porcentaje === null || typeof valor.porcentaje === 'number') &&
    typeof valor.cubetasEvaluadas === 'number' &&
    typeof valor.cubetasConDatos === 'number' &&
    typeof valor.interrupciones === 'number' &&
    typeof valor.mayorCorteSegundos === 'number'
  )
}

function esDisponibilidad(valor: unknown): valor is Disponibilidad {
  return (
    esObjeto(valor) &&
    (valor.ventana === '24h' || valor.ventana === '7d') &&
    typeof valor.cubetaSegundos === 'number' &&
    typeof valor.hasta === 'string' &&
    Array.isArray(valor.cubetas) &&
    valor.cubetas.every(esCubeta) &&
    esResumen(valor.resumen) &&
    Array.isArray(valor.cortes) &&
    valor.cortes.every(esCorte)
  )
}

export async function obtenerDisponibilidad(
  ventana: VentanaDisponibilidad,
): Promise<ResultadoDisponibilidad> {
  try {
    const { estado, datos } = await llamar(
      'GET',
      `/sistema/disponibilidad?ventana=${ventana}`,
    )
    if (estado === 401) return { ok: false, motivo: 'sesion' }
    if (estado !== 200 || !esDisponibilidad(datos))
      return { ok: false, motivo: 'fallo' }
    return { ok: true, disponibilidad: datos }
  } catch {
    return { ok: false, motivo: 'fallo' }
  }
}

export type RecursosServidor = {
  generadoEn: string
  disco: { totalBytes: number; usadoBytes: number } | null
  memoria: {
    totalBytes: number
    disponibleBytes: number
    swapTotalBytes: number
    swapUsadoBytes: number
  } | null
  cpu: {
    nucleos: number
    carga1: number
    carga5: number
    carga15: number
  } | null
  baseDatos: { totalBytes: number; lecturasBytes: number } | null
  certificado: { venceEn: string; diasRestantes: number } | null
  servicios: {
    baseDatosPanel: Parte
    baseDatosLecturas: Parte
    apiReceptora: Parte
  }
}

export type ResultadoServidor =
  | { ok: true; recursos: RecursosServidor }
  | { ok: false; motivo: 'sesion' | 'fallo' }

// Cada medición puede venir en null si el servidor no la pudo leer.
function esMedicion(
  valor: unknown,
  campos: readonly string[],
  textos: readonly string[] = [],
): boolean {
  if (valor === null) return true
  if (!esObjeto(valor)) return false
  return (
    campos.every(
      (c) => typeof valor[c] === 'number' && Number.isFinite(valor[c]),
    ) && textos.every((c) => typeof valor[c] === 'string')
  )
}

function esRecursos(valor: unknown): valor is RecursosServidor {
  if (!esObjeto(valor)) return false
  const s = valor.servicios
  return (
    typeof valor.generadoEn === 'string' &&
    esMedicion(valor.disco, ['totalBytes', 'usadoBytes']) &&
    esMedicion(valor.memoria, [
      'totalBytes',
      'disponibleBytes',
      'swapTotalBytes',
      'swapUsadoBytes',
    ]) &&
    esMedicion(valor.cpu, ['nucleos', 'carga1', 'carga5', 'carga15']) &&
    esMedicion(valor.baseDatos, ['totalBytes', 'lecturasBytes']) &&
    esMedicion(valor.certificado, ['diasRestantes'], ['venceEn']) &&
    esObjeto(s) &&
    esParte(s.baseDatosPanel) &&
    esParte(s.baseDatosLecturas) &&
    esParte(s.apiReceptora)
  )
}

// Solo administradores: cualquier otro usuario recibe 403 y se toma como fallo.
export async function obtenerServidor(): Promise<ResultadoServidor> {
  try {
    const { estado, datos } = await llamar('GET', '/sistema/servidor')
    if (estado === 401) return { ok: false, motivo: 'sesion' }
    if (estado !== 200 || !esRecursos(datos))
      return { ok: false, motivo: 'fallo' }
    return { ok: true, recursos: datos }
  } catch {
    return { ok: false, motivo: 'fallo' }
  }
}
