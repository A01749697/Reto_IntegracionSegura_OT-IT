import { leerCampo, llamar } from '../login/apiPanel'

export type EstadoCuenta = 'pendiente' | 'aprobado' | 'rechazado'
export type FiltroCuentas = EstadoCuenta | 'todas'
export type DecisionCuenta = 'aprobado' | 'rechazado'

export type Cuenta = {
  id: number
  nombre: string
  correo: string
  rol: 'usuario' | 'administrador'
  estado: EstadoCuenta
  bloqueada: boolean
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
    typeof c.bloqueada === 'boolean' &&
    typeof c.creadoEn === 'string'
  )
}

export async function listarCuentas(
  filtro: FiltroCuentas,
): Promise<ResultadoLista> {
  try {
    const { estado: codigo, datos } = await llamar(
      'GET',
      `/administracion/usuarios?estado=${filtro}`,
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

function aResultado(estado: number): ResultadoDecision {
  if (estado === 200) return { ok: true }
  if (estado === 401) return { ok: false, motivo: 'sesion' }
  if (estado === 403) return { ok: false, motivo: 'no_permitido' }
  if (estado === 404) return { ok: false, motivo: 'no_existe' }
  if (estado === 409) return { ok: false, motivo: 'sin_cambio' }
  return { ok: false, motivo: 'fallo' }
}

async function publicar(
  ruta: string,
  cuerpo?: object,
): Promise<ResultadoDecision> {
  try {
    const { estado } = await llamar('POST', ruta, cuerpo)
    return aResultado(estado)
  } catch {
    return { ok: false, motivo: 'fallo' }
  }
}

export function decidirCuenta(
  id: number,
  decision: DecisionCuenta,
): Promise<ResultadoDecision> {
  return publicar(`/administracion/usuarios/${id}/decision`, { decision })
}

export function desbloquearCuenta(id: number): Promise<ResultadoDecision> {
  return publicar(`/administracion/usuarios/${id}/desbloqueo`)
}

export function hacerAdministrador(id: number): Promise<ResultadoDecision> {
  return publicar(`/administracion/usuarios/${id}/administrador`)
}
