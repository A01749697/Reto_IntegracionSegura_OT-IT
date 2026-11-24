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
