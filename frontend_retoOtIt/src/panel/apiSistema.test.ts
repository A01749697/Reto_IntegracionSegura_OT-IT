import { afterEach, describe, expect, it, vi } from 'vitest'
import { obtenerDisponibilidad, obtenerEstado } from './apiSistema'

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

const disponibilidad = {
  ventana: '24h',
  cubetaSegundos: 900,
  hasta: '2026-11-12T12:07:00.000Z',
  cubetas: [
    { inicio: '2026-11-12T11:45:00.000Z', lecturas: 3, estado: 'con_datos' },
    { inicio: '2026-11-12T12:00:00.000Z', lecturas: 0, estado: 'en_curso' },
  ],
  resumen: {
    porcentaje: 100,
    cubetasEvaluadas: 1,
    cubetasConDatos: 1,
    interrupciones: 0,
    mayorCorteSegundos: 0,
  },
  cortes: [],
}

describe('obtenerDisponibilidad', () => {
  it('pide la ventana indicada y entrega el historial', async () => {
    responder(200, disponibilidad)
    expect(await obtenerDisponibilidad('24h')).toEqual({
      ok: true,
      disponibilidad,
    })
    expect(fetch).toHaveBeenCalledWith(
      '/api/panel/sistema/disponibilidad?ventana=24h',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('acepta un porcentaje nulo cuando aún no hay historia', async () => {
    const vacio = {
      ...disponibilidad,
      resumen: { ...disponibilidad.resumen, porcentaje: null },
    }
    responder(200, vacio)
    expect(await obtenerDisponibilidad('7d')).toEqual({
      ok: true,
      disponibilidad: vacio,
    })
  })

  it('el 401 se toma como sesión caducada', async () => {
    responder(401, { error: 'x' })
    expect(await obtenerDisponibilidad('24h')).toEqual({
      ok: false,
      motivo: 'sesion',
    })
  })

  it.each([
    [{ ...disponibilidad, ventana: '30d' }],
    [{ ...disponibilidad, cubetas: 'no' }],
    [
      {
        ...disponibilidad,
        cubetas: [{ inicio: 'x', lecturas: 1, estado: 'raro' }],
      },
    ],
    [{ ...disponibilidad, resumen: { porcentaje: 'alto' } }],
    [{ ...disponibilidad, cortes: [{ desde: 'x' }] }],
    [null],
  ])('falla si la respuesta no tiene la forma esperada: %j', async (cuerpo) => {
    responder(200, cuerpo)
    expect(await obtenerDisponibilidad('24h')).toEqual({
      ok: false,
      motivo: 'fallo',
    })
  })

  it('falla si el servidor da error o no hay red', async () => {
    responder(500, { error: 'x' })
    expect((await obtenerDisponibilidad('24h')).ok).toBe(false)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('red')))
    expect(await obtenerDisponibilidad('24h')).toEqual({
      ok: false,
      motivo: 'fallo',
    })
  })
})
