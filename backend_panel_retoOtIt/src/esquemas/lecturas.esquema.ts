// Reglas de los filtros del historial (viajan en la dirección: ?plc=...&variable=...).
// plc es la estación del historian (S7-300, S7-1500, S7-1200) y variable es el nombre del nodo.
// Todo lo que no cumpla se rechaza.
import {
  esPlcHistorian,
  FORMATO_NODO,
  type PlcHistorian,
} from '../configuracion/historian'

export type ConsultaHistorial = {
  plc: PlcHistorian
  variable: string
  desde: Date
  hasta: Date
}

export type ResultadoConsulta =
  { ok: true; consulta: ConsultaHistorial } | { ok: false; error: string }

const CAMPOS = ['plc', 'variable', 'desde', 'hasta']
const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/

function esObjeto(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

// Devuelve la fecha, o null si el texto no es una fecha ISO en UTC que exista de verdad.
function leerFecha(x: unknown): Date | null {
  if (typeof x !== 'string' || !FORMATO_FECHA.test(x)) return null
  const fecha = new Date(x)
  if (Number.isNaN(fecha.getTime())) return null
  // JavaScript convierte un 31 de noviembre en 1 de diciembre; aquí se rechaza.
  if (fecha.toISOString().slice(0, 19) !== x.slice(0, 19)) return null
  return fecha
}

export function validarConsultaHistorial(consulta: unknown): ResultadoConsulta {
  if (!esObjeto(consulta)) {
    return { ok: false, error: 'La consulta no es válida' }
  }

  const claves = Object.keys(consulta)
  if (
    claves.length !== CAMPOS.length ||
    !claves.every((c) => CAMPOS.includes(c))
  ) {
    return {
      ok: false,
      error: 'Se necesitan exactamente plc, variable, desde y hasta',
    }
  }

  const { plc, variable } = consulta
  if (!esPlcHistorian(plc)) {
    return { ok: false, error: 'plc no es válido' }
  }
  if (typeof variable !== 'string' || !FORMATO_NODO.test(variable)) {
    return { ok: false, error: 'variable no es válida' }
  }

  const desde = leerFecha(consulta.desde)
  if (!desde) {
    return {
      ok: false,
      error:
        'desde debe ser una fecha ISO en UTC, por ejemplo 2026-10-28T16:00:00Z',
    }
  }
  const hasta = leerFecha(consulta.hasta)
  if (!hasta) {
    return {
      ok: false,
      error:
        'hasta debe ser una fecha ISO en UTC, por ejemplo 2026-10-28T17:00:00Z',
    }
  }
  if (desde.getTime() >= hasta.getTime()) {
    return { ok: false, error: 'desde debe ser anterior a hasta' }
  }

  return { ok: true, consulta: { plc, variable, desde, hasta } }
}

// Indicadores: un periodo partido en tramos de una hora o un día.
export type ConsultaIndicadores = {
  desde: Date
  hasta: Date
  cubetaSegundos: number
}

export type ResultadoIndicadores =
  { ok: true; consulta: ConsultaIndicadores } | { ok: false; error: string }

const CUBETAS: Record<string, number> = { hora: 3600, dia: 86400 }
const CAMPOS_INDICADORES = ['desde', 'hasta', 'cubeta']

export function validarConsultaIndicadores(
  consulta: unknown,
  limites: { maximoDias: number; maximoCubetas: number },
): ResultadoIndicadores {
  if (!esObjeto(consulta))
    return { ok: false, error: 'La consulta no es válida' }
  const claves = Object.keys(consulta)
  if (
    claves.length !== CAMPOS_INDICADORES.length ||
    !claves.every((c) => CAMPOS_INDICADORES.includes(c))
  ) {
    return {
      ok: false,
      error: 'Se necesitan exactamente desde, hasta y cubeta',
    }
  }
  const { cubeta } = consulta
  if (typeof cubeta !== 'string' || !Object.hasOwn(CUBETAS, cubeta)) {
    return { ok: false, error: 'cubeta debe ser hora o dia' }
  }
  const desde = leerFecha(consulta.desde)
  const hasta = leerFecha(consulta.hasta)
  if (!desde || !hasta) {
    return {
      ok: false,
      error:
        'desde y hasta deben ser fechas ISO en UTC, por ejemplo 2026-10-28T06:00:00Z',
    }
  }
  const largo = hasta.getTime() - desde.getTime()
  if (largo <= 0) return { ok: false, error: 'desde debe ser anterior a hasta' }
  if (largo > limites.maximoDias * 86400_000) {
    return {
      ok: false,
      error: `El periodo no puede pasar de ${limites.maximoDias} días`,
    }
  }
  const cubetaSegundos = CUBETAS[cubeta] ?? 3600
  if (largo / (cubetaSegundos * 1000) > limites.maximoCubetas) {
    return {
      ok: false,
      error: `El periodo no puede tener más de ${limites.maximoCubetas} tramos`,
    }
  }
  return { ok: true, consulta: { desde, hasta, cubetaSegundos } }
}

// Cambios de varios nodos de una estación desde una fecha (los repite el gemelo).
// nodos va separado por comas: ?plc=S7-1500&nodos=TAB_PASO,TAB_SELLO&desde=...
export type ConsultaCambios = {
  plc: PlcHistorian
  nodos: string[]
  desde: Date
}

export type ResultadoCambios =
  { ok: true; consulta: ConsultaCambios } | { ok: false; error: string }

const CAMPOS_CAMBIOS = ['plc', 'nodos', 'desde']

export function validarConsultaCambios(
  consulta: unknown,
  maximoNodos: number,
): ResultadoCambios {
  if (!esObjeto(consulta))
    return { ok: false, error: 'La consulta no es válida' }
  const claves = Object.keys(consulta)
  if (
    claves.length !== CAMPOS_CAMBIOS.length ||
    !claves.every((c) => CAMPOS_CAMBIOS.includes(c))
  ) {
    return { ok: false, error: 'Se necesitan exactamente plc, nodos y desde' }
  }
  const { plc, nodos } = consulta
  if (!esPlcHistorian(plc)) return { ok: false, error: 'plc no es válido' }
  if (typeof nodos !== 'string')
    return { ok: false, error: 'nodos no es válido' }
  const lista = [...new Set(nodos.split(','))]
  if (
    lista.length === 0 ||
    lista.length > maximoNodos ||
    !lista.every((n) => FORMATO_NODO.test(n))
  ) {
    return {
      ok: false,
      error: `nodos debe ser una lista de 1 a ${maximoNodos} nombres separados por comas`,
    }
  }
  const desde = leerFecha(consulta.desde)
  if (!desde) {
    return {
      ok: false,
      error:
        'desde debe ser una fecha ISO en UTC, por ejemplo 2026-10-28T16:00:00Z',
    }
  }
  return { ok: true, consulta: { plc, nodos: lista, desde } }
}
