import { leerCampo, llamar } from '../login/apiPanel'

export type GrupoBitacora = 'todos' | 'alertas'

export type EventoBitacora = {
  id: number
  ocurrioEn: string
  tipo: string
  usuarioId: number | null
  correo: string | null
  ip: string | null
  actorCorreo: string | null
}

export type ResultadoBitacora =
  | { ok: true; eventos: EventoBitacora[]; hayMas: boolean }
  | { ok: false; motivo: 'sesion' | 'fallo' }

const esTextoONulo = (valor: unknown) =>
  valor === null || typeof valor === 'string'

function esEvento(valor: unknown): valor is EventoBitacora {
  if (typeof valor !== 'object' || valor === null) return false
  const e = valor as Record<string, unknown>
  return (
    typeof e.id === 'number' &&
    typeof e.ocurrioEn === 'string' &&
    typeof e.tipo === 'string' &&
    (e.usuarioId === null || typeof e.usuarioId === 'number') &&
    esTextoONulo(e.correo) &&
    esTextoONulo(e.ip) &&
    esTextoONulo(e.actorCorreo)
  )
}

// antes = id del ultimo evento que ya se ve, para pedir los que siguen
export async function listarBitacora(
  grupo: GrupoBitacora,
  antes?: number,
): Promise<ResultadoBitacora> {
  try {
    const ruta =
      `/administracion/bitacora?grupo=${grupo}` +
      (antes === undefined ? '' : `&antes=${antes}`)
    const { estado, datos } = await llamar('GET', ruta)
    if (estado === 401 || estado === 403) return { ok: false, motivo: 'sesion' }
    const eventos = leerCampo(datos, 'eventos')
    const hayMas = leerCampo(datos, 'hayMas')
    if (
      estado !== 200 ||
      !Array.isArray(eventos) ||
      !eventos.every(esEvento) ||
      typeof hayMas !== 'boolean'
    ) {
      return { ok: false, motivo: 'fallo' }
    }
    return { ok: true, eventos, hayMas }
  } catch {
    return { ok: false, motivo: 'fallo' }
  }
}

export type ResultadoExportar =
  | { ok: true; archivo: Blob; truncado: boolean }
  | { ok: false; motivo: 'sesion' | 'fallo' }

// Se queda con los bytes tal cual (blob) para no perder la marca UTF-8 que necesita Excel.
export async function exportarBitacora(
  grupo: GrupoBitacora,
): Promise<ResultadoExportar> {
  try {
    const respuesta = await fetch(
      `/api/panel/administracion/bitacora/exportar?grupo=${grupo}`,
      { method: 'GET' },
    )
    if (respuesta.status === 401 || respuesta.status === 403) {
      return { ok: false, motivo: 'sesion' }
    }
    if (respuesta.status !== 200) return { ok: false, motivo: 'fallo' }
    return {
      ok: true,
      archivo: await respuesta.blob(),
      truncado: respuesta.headers.get('X-Truncado') === 'si',
    }
  } catch {
    return { ok: false, motivo: 'fallo' }
  }
}
