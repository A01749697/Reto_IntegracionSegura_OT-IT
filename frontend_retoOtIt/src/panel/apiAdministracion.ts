import { leerCampo, llamar } from '../login/apiPanel'

export type EstadoCuenta = 'pendiente' | 'aprobado' | 'rechazado'
export type DecisionCuenta = 'aprobado' | 'rechazado'

export type Cuenta = {
  id: number
  nombre: string
  correo: string
  rol: 'usuario' | 'administrador'
  estado: EstadoCuenta
  creadoEn: string
}

export type ResultadoLista =
  { ok: true; cuentas: Cuenta[] } | { ok: false; motivo: 'sesion' | 'fallo' }

export type MotivoDecision =
  'sesion' | 'no_existe' | 'no_permitido' | 'sin_cambio' | 'fallo'

export type ResultadoDecision =
  { ok: true } | { ok: false; motivo: MotivoDecision }

function esCuenta(valor: unknown): valor is Cuenta {
  if (typeof valor !== 'object' || valor === null) return false
  const c = valor as Record<string, unknown>
  return (
    typeof c.id === 'number' &&
    typeof c.nombre === 'string' &&
    typeof c.correo === 'string' &&
    (c.rol === 'usuario' || c.rol === 'administrador') &&
    (c.estado === 'pendiente' ||
      c.estado === 'aprobado' ||
      c.estado === 'rechazado') &&
    typeof c.creadoEn === 'string'
  )
}

export async function listarCuentas(
  estado: EstadoCuenta,
): Promise<ResultadoLista> {
  try {
    const { estado: codigo, datos } = await llamar(
      'GET',
      `/administracion/usuarios?estado=${estado}`,
    )
    // 403 = ya no es administrador, igual que sin sesion
    if (codigo === 401 || codigo === 403) return { ok: false, motivo: 'sesion' }
    const cuentas = leerCampo(datos, 'usuarios')
    if (codigo !== 200 || !Array.isArray(cuentas) || !cuentas.every(esCuenta)) {
      return { ok: false, motivo: 'fallo' }
    }
    return { ok: true, cuentas }
  } catch {
    return { ok: false, motivo: 'fallo' }
  }
}

export async function decidirCuenta(
  id: number,
  decision: DecisionCuenta,
): Promise<ResultadoDecision> {
  try {
    const { estado } = await llamar(
      'POST',
      `/administracion/usuarios/${id}/decision`,
      { decision },
    )
    if (estado === 200) return { ok: true }
    if (estado === 401) return { ok: false, motivo: 'sesion' }
    if (estado === 403) return { ok: false, motivo: 'no_permitido' }
    if (estado === 404) return { ok: false, motivo: 'no_existe' }
    if (estado === 409) return { ok: false, motivo: 'sin_cambio' }
    return { ok: false, motivo: 'fallo' }
  } catch {
    return { ok: false, motivo: 'fallo' }
  }
}
