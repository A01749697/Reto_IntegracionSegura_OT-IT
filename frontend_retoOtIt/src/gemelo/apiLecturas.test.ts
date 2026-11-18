import { afterEach, describe, expect, it, vi } from 'vitest'
import { obtenerUltimasLecturas } from './apiLecturas'

function responder(estado: number, cuerpo?: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ status: estado, json: async () => cuerpo }),
  )
}

const lecturas = [
  {
    plc: 'S7-1500',
    variable: 'contador_piezas',
    valor: 12,
    ts: '2026-11-06T18:00:00.000Z',
  },
]

afterEach(() => vi.unstubAllGlobals())

describe('obtenerUltimasLecturas', () => {
  it('entrega las lecturas', async () => {
    responder(200, { lecturas })
    expect(await obtenerUltimasLecturas()).toEqual({ ok: true, lecturas })
    expect(fetch).toHaveBeenCalledWith(
      '/api/panel/lecturas/ultimas',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('acepta que todavía no haya ninguna', async () => {
    responder(200, { lecturas: [] })
    expect(await obtenerUltimasLecturas()).toEqual({ ok: true, lecturas: [] })
  })

  it('el 401 se toma como sesión caducada', async () => {
    responder(401, { error: 'x' })
    expect(await obtenerUltimasLecturas()).toEqual({
      ok: false,
      motivo: 'sesion',
    })
  })

  it.each([
    [{ lecturas: 'no' }],
    [{ lecturas: [{ ...lecturas[0], valor: '12' }] }],
    [{ lecturas: [{ ...lecturas[0], valor: null }] }],
    [{ lecturas: [{ plc: 'S7-1500' }] }],
    [{}],
    [null],
  ])('falla si la respuesta no tiene la forma esperada: %j', async (cuerpo) => {
    responder(200, cuerpo)
    expect(await obtenerUltimasLecturas()).toEqual({
      ok: false,
      motivo: 'fallo',
    })
  })

  it('falla si el servidor da error o no hay red', async () => {
    responder(500, { error: 'x' })
    expect((await obtenerUltimasLecturas()).ok).toBe(false)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('red')))
    expect(await obtenerUltimasLecturas()).toEqual({
      ok: false,
      motivo: 'fallo',
    })
  })
})
