import { seguridad } from '../configuracion/seguridad'
import {
  TABLAS_DATOS,
  type TablaDatos,
} from '../repositorios/datos.repositorio'
import type { Resultado } from './autenticacion.esquema'

export type ConsultaDatos = {
  buscar: string | null
  antes: number | null
  limite: number
}

const CAMPOS = ['buscar', 'antes', 'limite']
const FORMATO_ENTERO = /^[1-9]\d{0,14}$/

// Saltos de línea, tabuladores y demás no tienen nada que hacer en un texto de búsqueda.
function tieneCaracteresDeControl(texto: string): boolean {
  return [...texto].some((letra) => {
    const codigo = letra.charCodeAt(0)
    return codigo < 32 || codigo === 127
  })
}

function esObjeto(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

// Solo vale un nombre de la lista; cualquier otra cosa es "no existe".
export function validarTabla(valor: unknown): Resultado<TablaDatos> {
  const tabla = TABLAS_DATOS.find((permitida) => permitida === valor)
  if (tabla === undefined) return { ok: false, error: 'La tabla no existe' }
  return { ok: true, datos: tabla }
}

export function validarConsultaDatos(
  consulta: unknown,
): Resultado<ConsultaDatos> {
  if (!esObjeto(consulta)) {
    return { ok: false, error: 'La consulta no es válida' }
  }
  if (Object.keys(consulta).some((clave) => !CAMPOS.includes(clave))) {
    return { ok: false, error: `Solo se permiten: ${CAMPOS.join(', ')}` }
  }

  const { buscar, antes, limite } = consulta

  let texto: string | null = null
  if (buscar !== undefined) {
    if (typeof buscar !== 'string' || tieneCaracteresDeControl(buscar)) {
      return { ok: false, error: 'buscar no es válido' }
    }
    const limpio = buscar.trim()
    if (limpio.length > seguridad.datos.largoMaximoBusqueda) {
      return {
        ok: false,
        error: `buscar no puede pasar de ${seguridad.datos.largoMaximoBusqueda} caracteres`,
      }
    }
    // un texto vacío es lo mismo que no buscar nada
    texto = limpio === '' ? null : limpio
  }

  let idAntes: number | null = null
  if (antes !== undefined) {
    if (typeof antes !== 'string' || !FORMATO_ENTERO.test(antes)) {
      return { ok: false, error: 'antes no es válido' }
    }
    idAntes = Number(antes)
  }

  let cuantos: number = seguridad.datos.porDefecto
  if (limite !== undefined) {
    if (typeof limite !== 'string' || !FORMATO_ENTERO.test(limite)) {
      return { ok: false, error: 'limite no es válido' }
    }
    cuantos = Number(limite)
    if (cuantos > seguridad.datos.maximo) {
      return {
        ok: false,
        error: `limite no puede pasar de ${seguridad.datos.maximo}`,
      }
    }
  }

  return { ok: true, datos: { buscar: texto, antes: idAntes, limite: cuantos } }
}
