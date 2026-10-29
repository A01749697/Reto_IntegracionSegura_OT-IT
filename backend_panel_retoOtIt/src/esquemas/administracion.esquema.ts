// Reglas de lo que manda la pantalla de administrador: qué lista pedir, qué cuenta y qué decisión.
// Todo lo que no cumpla se rechaza.
import type { Resultado } from './autenticacion.esquema'

const ESTADOS = ['pendiente', 'aprobado', 'rechazado'] as const
const DECISIONES = ['aprobado', 'rechazado'] as const

export type EstadoLista = (typeof ESTADOS)[number]
export type DecisionCuenta = (typeof DECISIONES)[number]

// Sin ceros a la izquierda y de hasta 15 dígitos, para que siempre quepa como número exacto.
const FORMATO_ID = /^[1-9]\d{0,14}$/

function esObjeto(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

// El filtro de la lista viaja en la dirección: ?estado=pendiente. Si no viene, se usa "pendiente".
export function validarEstadoLista(consulta: unknown): Resultado<EstadoLista> {
  if (!esObjeto(consulta)) {
    return { ok: false, error: 'La consulta no es válida' }
  }

  const claves = Object.keys(consulta)
  if (claves.length === 0) return { ok: true, datos: 'pendiente' }
  if (claves.length !== 1 || claves[0] !== 'estado') {
    return { ok: false, error: 'Solo se permite el filtro estado' }
  }

  const estado = ESTADOS.find((e) => e === consulta.estado)
  if (estado === undefined) {
    return { ok: false, error: `estado debe ser: ${ESTADOS.join(', ')}` }
  }
  return { ok: true, datos: estado }
}

// El número de la cuenta viaja en la dirección: /usuarios/3/decision.
export function validarIdUsuario(id: unknown): Resultado<number> {
  if (typeof id !== 'string' || !FORMATO_ID.test(id)) {
    return { ok: false, error: 'El número de cuenta no es válido' }
  }
  return { ok: true, datos: Number(id) }
}

export function validarDecision(cuerpo: unknown): Resultado<DecisionCuenta> {
  if (!esObjeto(cuerpo)) {
    return { ok: false, error: 'El cuerpo debe ser un objeto JSON' }
  }

  const claves = Object.keys(cuerpo)
  if (claves.length !== 1 || claves[0] !== 'decision') {
    return { ok: false, error: 'Solo se permite el campo "decision"' }
  }

  const decision = DECISIONES.find((d) => d === cuerpo.decision)
  if (decision === undefined) {
    return { ok: false, error: `decision debe ser: ${DECISIONES.join(', ')}` }
  }
  return { ok: true, datos: decision }
}
