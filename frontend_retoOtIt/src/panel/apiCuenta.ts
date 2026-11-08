import { leerCampo, llamar } from '../login/apiPanel'

export type ResultadoCambioClave =
  | { ok: true }
  | {
      ok: false
      motivo:
        | 'sesion'
        | 'actual_incorrecta'
        | 'bloqueada'
        | 'limite'
        | 'invalido'
        | 'fallo'
    }

export async function cambiarContrasena(
  actual: string,
  nueva: string,
): Promise<ResultadoCambioClave> {
  try {
    const { estado, datos } = await llamar('POST', '/cuenta/contrasena', {
      contrasenaActual: actual,
      contrasenaNueva: nueva,
    })
    if (estado === 200) return { ok: true }
    if (estado === 401) return { ok: false, motivo: 'sesion' }
    if (estado === 400) return { ok: false, motivo: 'invalido' }
    if (estado === 403 && leerCampo(datos, 'codigo') === 'actual_incorrecta') {
      return { ok: false, motivo: 'actual_incorrecta' }
    }
    // 429 con codigo = la cuenta esta bloqueada; sin codigo = limite por IP
    if (estado === 429) {
      return leerCampo(datos, 'codigo') === 'bloqueada'
        ? { ok: false, motivo: 'bloqueada' }
        : { ok: false, motivo: 'limite' }
    }
    return { ok: false, motivo: 'fallo' }
  } catch {
    return { ok: false, motivo: 'fallo' }
  }
}
