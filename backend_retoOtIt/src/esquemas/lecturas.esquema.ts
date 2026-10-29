// Reglas del JSON que manda el agente de IT. Todo lo que no cumpla se rechaza.
import {
  MAXIMO_LECTURAS_POR_ENVIO,
  PLC_PERMITIDOS,
  VALOR_ABSOLUTO_MAXIMO,
  VARIABLES_PERMITIDAS,
  VENTANA_FUTURO_MS,
  VENTANA_PASADO_MS,
} from '../configuracion/reglas'

export type Lectura = {
  ts: Date
  plc: string
  variable: string
  valor: number
}

export type ResultadoValidacion =
  { ok: true; lecturas: Lectura[] } | { ok: false; error: string }

const CAMPOS = ['ts', 'plc', 'variable', 'valor']
const FORMATO_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/

function esObjeto(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function estaEnLista(lista: readonly string[], x: unknown): x is string {
  return typeof x === 'string' && lista.includes(x)
}

// Devuelve la lectura ya limpia, o un texto que explica qué está mal.
function validarLectura(lectura: unknown, ahora: number): Lectura | string {
  if (!esObjeto(lectura)) return 'debe ser un objeto'

  const claves = Object.keys(lectura)
  if (
    claves.length !== CAMPOS.length ||
    !claves.every((c) => CAMPOS.includes(c))
  ) {
    return 'debe tener exactamente los campos ts, plc, variable y valor'
  }

  const { ts, plc, variable, valor } = lectura

  if (!estaEnLista(PLC_PERMITIDOS, plc)) return 'plc no permitido'
  if (!estaEnLista(VARIABLES_PERMITIDAS, variable))
    return 'variable no permitida'

  if (
    typeof valor !== 'number' ||
    !Number.isFinite(valor) ||
    Math.abs(valor) > VALOR_ABSOLUTO_MAXIMO
  ) {
    return 'valor debe ser un número finito'
  }

  if (typeof ts !== 'string' || !FORMATO_TS.test(ts)) {
    return 'ts debe ser una fecha ISO en UTC, por ejemplo 2026-10-28T16:00:00Z'
  }
  const fecha = new Date(ts)
  const instante = fecha.getTime()
  if (Number.isNaN(instante)) return 'ts no es una fecha válida'
  // JavaScript convierte solo un 31 de noviembre en 1 de diciembre; aquí se rechaza.
  if (fecha.toISOString().slice(0, 19) !== ts.slice(0, 19)) {
    return 'ts no es una fecha válida'
  }
  if (
    instante < ahora - VENTANA_PASADO_MS ||
    instante > ahora + VENTANA_FUTURO_MS
  ) {
    return 'ts fuera del rango permitido'
  }

  return { ts: fecha, plc, variable, valor }
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
