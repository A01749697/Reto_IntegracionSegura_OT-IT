// Reglas de la consulta del historial de disponibilidad (viaja en la dirección: ?ventana=24h).
// Todo lo que no cumpla se rechaza.
import type { Ventana } from '../utilidades/disponibilidad'

export type ResultadoConsultaDisponibilidad =
  { ok: true; ventana: Ventana } | { ok: false; error: string }

const VENTANAS: readonly string[] = ['24h', '7d']

function esObjeto(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

export function validarConsultaDisponibilidad(
  consulta: unknown,
): ResultadoConsultaDisponibilidad {
  if (!esObjeto(consulta)) {
    return { ok: false, error: 'La consulta no es válida' }
  }
  const claves = Object.keys(consulta)
  if (claves.length !== 1 || claves[0] !== 'ventana') {
    return { ok: false, error: 'Se necesita exactamente ventana' }
  }
  const { ventana } = consulta
  if (typeof ventana !== 'string' || !VENTANAS.includes(ventana)) {
    return { ok: false, error: 'ventana debe ser 24h o 7d' }
  }
  return { ok: true, ventana: ventana as Ventana }
}
