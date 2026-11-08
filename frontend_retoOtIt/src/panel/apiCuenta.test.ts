import { afterEach, describe, expect, it, vi } from 'vitest'
import { cambiarContrasena } from './apiCuenta'

function responder(estado: number, cuerpo?: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ status: estado, json: async () => cuerpo }),
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('cambiarContrasena', () => {
  it('manda las dos contraseñas y responde ok', async () => {
    responder(200, { mensaje: 'listo' })
    expect(await cambiarContrasena('vieja', 'nueva-nueva-1')).toEqual({
      ok: true,
    })
    expect(fetch).toHaveBeenCalledWith(
      '/api/panel/cuenta/contrasena',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          contrasenaActual: 'vieja',
          contrasenaNueva: 'nueva-nueva-1',
        }),
      }),
    )
  })

  it.each([
    [401, { error: 'x' }, 'sesion'],
    [400, { error: 'x' }, 'invalido'],
    [403, { error: 'x', codigo: 'actual_incorrecta' }, 'actual_incorrecta'],
    [429, { error: 'x', codigo: 'bloqueada' }, 'bloqueada'],
    [429, { error: 'x' }, 'limite'],
    [403, { error: 'x' }, 'fallo'],
    [500, { error: 'x' }, 'fallo'],
  ] as const)('el %s con %j es %s', async (codigo, cuerpo, motivo) => {
    responder(codigo, cuerpo)
    expect(await cambiarContrasena('a', 'b')).toEqual({ ok: false, motivo })
  })

  it('falla si no hay red', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('red')))
    expect(await cambiarContrasena('a', 'b')).toEqual({
      ok: false,
      motivo: 'fallo',
    })
  })
})
