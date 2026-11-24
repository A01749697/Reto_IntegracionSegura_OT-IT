// Reglas del JSON que manda el agente de IT. Todo lo que no cumpla se rechaza.
// Cada lectura es una fila del historian: { estacion, ts_plc, nodo, valor }.
import {
  ESTACIONES,
  FORMATO_NODO,
  FORMATO_VALOR,
  MAXIMO_LECTURAS_POR_ENVIO,
  VENTANA_FUTURO_MS,
  VENTANA_PASADO_MS,
  type Estacion,
} from '../configuracion/reglas'

export type Lectura = {
  estacion: Estacion
  tsPlc: Date | null
  nodo: string
  valor: string
}

export type ResultadoValidacion =
  { ok: true; lecturas: Lectura[] } | { ok: false; error: string }

const CAMPOS = ['estacion', 'ts_plc', 'nodo', 'valor']
const FORMATO_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/

function esObjeto(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function esEstacion(x: unknown): x is Estacion {
  return typeof x === 'string' && (ESTACIONES as string[]).includes(x)
}

// ts_plc puede venir vacío (null), como en la tabla. Si viene, debe ser una fecha UTC real y reciente.
function validarFecha(ts: unknown, ahora: number): Date | null | string {
  if (ts === null) return null
  if (typeof ts !== 'string' || !FORMATO_TS.test(ts)) {
    return 'ts_plc debe ser null o una fecha ISO en UTC, por ejemplo 2026-10-28T16:00:00Z'
  }
  const fecha = new Date(ts)
  const instante = fecha.getTime()
  if (Number.isNaN(instante)) return 'ts_plc no es una fecha válida'
  // JavaScript convierte solo un 31 de noviembre en 1 de diciembre; aquí se rechaza.
  if (fecha.toISOString().slice(0, 19) !== ts.slice(0, 19)) {
    return 'ts_plc no es una fecha válida'
  }
  if (
    instante < ahora - VENTANA_PASADO_MS ||
    instante > ahora + VENTANA_FUTURO_MS
  ) {
    return 'ts_plc fuera del rango permitido'
  }
  return fecha
}

// Devuelve la lectura ya limpia, o un texto que explica qué está mal.
function validarLectura(lectura: unknown, ahora: number): Lectura | string {
  if (!esObjeto(lectura)) return 'debe ser un objeto'

  const claves = Object.keys(lectura)
  if (
    claves.length !== CAMPOS.length ||
    !claves.every((c) => CAMPOS.includes(c))
  ) {
    return 'debe tener exactamente los campos estacion, ts_plc, nodo y valor'
  }

  const { estacion, ts_plc, nodo, valor } = lectura

  if (!esEstacion(estacion)) return 'estacion no permitida'
  if (typeof nodo !== 'string' || !FORMATO_NODO.test(nodo))
    return 'nodo no válido'
  if (typeof valor !== 'string' || !FORMATO_VALOR.test(valor))
    return 'valor debe ser texto corto, por ejemplo True, 4 o 0.0'

  const tsPlc = validarFecha(ts_plc, ahora)
  if (typeof tsPlc === 'string') return tsPlc

  return { estacion, tsPlc, nodo, valor }
}

export function validarCuerpo(
  cuerpo: unknown,
  ahora: number,
): ResultadoValidacion {
  if (!esObjeto(cuerpo)) {
    return { ok: false, error: 'El cuerpo debe ser un objeto JSON' }
  }

  const claves = Object.keys(cuerpo)
  if (claves.length !== 1 || claves[0] !== 'lecturas') {
    return { ok: false, error: 'Solo se permite el campo "lecturas"' }
  }

  const lista = cuerpo.lecturas
  if (
    !Array.isArray(lista) ||
    lista.length === 0 ||
    lista.length > MAXIMO_LECTURAS_POR_ENVIO
  ) {
    return {
      ok: false,
      error: `"lecturas" debe ser una lista de 1 a ${MAXIMO_LECTURAS_POR_ENVIO} elementos`,
    }
  }

  const lecturas: Lectura[] = []
  for (let i = 0; i < lista.length; i++) {
    const resultado = validarLectura(lista[i], ahora)
    if (typeof resultado === 'string') {
      return { ok: false, error: `lecturas[${i}]: ${resultado}` }
    }
    lecturas.push(resultado)
  }
  return { ok: true, lecturas }
}
