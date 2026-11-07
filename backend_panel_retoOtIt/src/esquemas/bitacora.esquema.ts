import { seguridad } from '../configuracion/seguridad'
import type { Resultado } from './autenticacion.esquema'

export type Grupo = 'todos' | 'alertas'

export type ConsultaBitacora = {
  grupo: Grupo
  antes: number | null
  limite: number
}

const CAMPOS = ['grupo', 'antes', 'limite']
const FORMATO_ENTERO = /^[1-9]\d{0,14}$/

function esObjeto(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

export function validarConsultaBitacora(
  consulta: unknown,
): Resultado<ConsultaBitacora> {
  if (!esObjeto(consulta)) {
    return { ok: false, error: 'La consulta no es válida' }
  }
  if (Object.keys(consulta).some((clave) => !CAMPOS.includes(clave))) {
    return { ok: false, error: `Solo se permiten: ${CAMPOS.join(', ')}` }
  }

  const { grupo = 'todos', antes, limite } = consulta
  if (grupo !== 'todos' && grupo !== 'alertas') {
    return { ok: false, error: 'grupo debe ser: todos, alertas' }
  }

  let idAntes: number | null = null
  if (antes !== undefined) {
    if (typeof antes !== 'string' || !FORMATO_ENTERO.test(antes)) {
      return { ok: false, error: 'antes no es válido' }
    }
    idAntes = Number(antes)
  }

  let cuantos: number = seguridad.bitacora.porDefecto
  if (limite !== undefined) {
    if (typeof limite !== 'string' || !FORMATO_ENTERO.test(limite)) {
      return { ok: false, error: 'limite no es válido' }
    }
    cuantos = Number(limite)
    if (cuantos > seguridad.bitacora.maximo) {
      return {
        ok: false,
        error: `limite no puede pasar de ${seguridad.bitacora.maximo}`,
      }
    }
  }

  return { ok: true, datos: { grupo, antes: idAntes, limite: cuantos } }
}
