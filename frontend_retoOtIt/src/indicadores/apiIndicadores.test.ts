import { afterEach, describe, expect, it, vi } from 'vitest'
import { obtenerIndicadores } from './apiIndicadores'

function responder(estado: number, cuerpo?: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ status: estado, json: async () => cuerpo }),
  )
}

const tramo = {
  inicio: '2026-11-24T06:00:00.000Z',
  aluminio: 3,
  plastico: 4,
  marcha: 1800,
  paro: 60,
  sinRegistro: 1740,
  paros: 1,
  ciclos: 7,
  segundosCiclo: 105,
}
const desde = new Date('2026-11-24T06:00:00.000Z')
const hasta = new Date('2026-11-25T06:00:00.000Z')

afterEach(() => vi.unstubAllGlobals())

describe('obtenerIndicadores', () => {
  it('pide el periodo y entrega los tramos', async () => {
    responder(200, { cubetas: [tramo], truncado: false })
    expect(await obtenerIndicadores(desde, hasta, 'hora')).toEqual({
      ok: true,
      tramos: [tramo],
      truncado: false,
    })
    const [url] = vi.mocked(fetch).mock.calls[0] as [string]
    expect(url).toBe(
      '/api/panel/lecturas/indicadores?desde=2026-11-24T06%3A00%3A00.000Z&hasta=2026-11-25T06%3A00%3A00.000Z&cubeta=hora',
    )
  })

  it('el 401 es sesión caducada', async () => {
    responder(401, {})
    expect(await obtenerIndicadores(desde, hasta, 'dia')).toEqual({
      ok: false,
      motivo: 'sesion',
    })
  })

  it('una respuesta rara es un fallo', async () => {
    responder(200, { cubetas: [{ ...tramo, aluminio: 'tres' }] })
    expect(await obtenerIndicadores(desde, hasta, 'dia')).toEqual({
      ok: false,
      motivo: 'fallo',
    })
  })
})
