import { afterEach, describe, expect, it, vi } from 'vitest'
import { obtenerEstado } from './apiSistema'

function responder(estado: number, cuerpo?: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ status: estado, json: async () => cuerpo }),
  )
}

const estado = {
  api: 'ok',
  baseDatosPanel: 'ok',
  baseDatosLecturas: 'ok',
  datos: 'al_dia',
  variables: [
    {
      plc: 'S7-1500',
      variable: 'contador_piezas',
      ts: '2026-11-06T18:00:00.000Z',
      segundosDesdeRecibida: 12,
    },
  ],
}

afterEach(() => vi.unstubAllGlobals())

describe('obtenerEstado', () => {
  it('entrega el estado del sistema', async () => {
    responder(200, estado)
    expect(await obtenerEstado()).toEqual({ ok: true, estado })
    expect(fetch).toHaveBeenCalledWith(
      '/api/panel/sistema/estado',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('el 401 se toma como sesión caducada', async () => {
    responder(401, { error: 'x' })
    expect(await obtenerEstado()).toEqual({ ok: false, motivo: 'sesion' })
  })

  it.each([
    [{ ...estado, api: 'mal' }],
    [{ ...estado, baseDatosPanel: 'quizas' }],
    [{ ...estado, datos: 'otro' }],
    [{ ...estado, variables: [{ plc: 'S7-1500' }] }],
    [{ ...estado, variables: 'no' }],
    [null],
  ])('falla si la respuesta no tiene la forma esperada: %j', async (cuerpo) => {
    responder(200, cuerpo)
    expect(await obtenerEstado()).toEqual({ ok: false, motivo: 'fallo' })
  })

  it('falla si el servidor da error o no hay red', async () => {
    responder(500, { error: 'x' })
    expect((await obtenerEstado()).ok).toBe(false)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('red')))
    expect(await obtenerEstado()).toEqual({ ok: false, motivo: 'fallo' })
  })
})
