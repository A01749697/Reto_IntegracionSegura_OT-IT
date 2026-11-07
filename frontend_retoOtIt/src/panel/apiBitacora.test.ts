import { afterEach, describe, expect, it, vi } from 'vitest'
import { listarBitacora } from './apiBitacora'

function responder(estado: number, cuerpo?: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ status: estado, json: async () => cuerpo }),
  )
}

const evento = {
  id: 9,
  ocurrioEn: '2026-11-06T18:00:00.000Z',
  tipo: 'entrada_fallida',
  usuarioId: null,
  correo: 'ana@ejemplo.com',
  ip: '203.0.113.7',
  actorCorreo: null,
}

afterEach(() => vi.unstubAllGlobals())

describe('listarBitacora', () => {
  it('pide el grupo y entrega los eventos', async () => {
    responder(200, { eventos: [evento], hayMas: true })
    expect(await listarBitacora('alertas')).toEqual({
      ok: true,
      eventos: [evento],
      hayMas: true,
    })
    expect(fetch).toHaveBeenCalledWith(
      '/api/panel/administracion/bitacora?grupo=alertas',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('con "antes" pide los eventos que siguen', async () => {
    responder(200, { eventos: [], hayMas: false })
    await listarBitacora('todos', 40)
    expect(fetch).toHaveBeenCalledWith(
      '/api/panel/administracion/bitacora?grupo=todos&antes=40',
      expect.anything(),
    )
  })

  it('acepta un tipo que esta versión no conoce', async () => {
    responder(200, {
      eventos: [{ ...evento, tipo: 'tipo_nuevo' }],
      hayMas: false,
    })
    expect((await listarBitacora('todos')).ok).toBe(true)
  })

  it.each([401, 403])('el %s se toma como sesión caducada', async (codigo) => {
    responder(codigo, { error: 'x' })
    expect(await listarBitacora('todos')).toEqual({
      ok: false,
      motivo: 'sesion',
    })
  })

  it.each([
    [{ eventos: [{ id: 'nueve' }], hayMas: false }],
    [{ eventos: [evento] }],
    [{ eventos: 'no', hayMas: false }],
    [{ eventos: [{ ...evento, ip: 5 }], hayMas: false }],
  ])('falla si la respuesta no tiene la forma esperada: %j', async (cuerpo) => {
    responder(200, cuerpo)
    expect(await listarBitacora('todos')).toEqual({
      ok: false,
      motivo: 'fallo',
    })
  })

  it('falla si el servidor da error o no hay red', async () => {
    responder(500, { error: 'x' })
    expect((await listarBitacora('todos')).ok).toBe(false)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('red')))
    expect(await listarBitacora('todos')).toEqual({
      ok: false,
      motivo: 'fallo',
    })
  })
})
