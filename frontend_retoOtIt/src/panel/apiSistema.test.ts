import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  obtenerDisponibilidad,
  obtenerEstado,
  obtenerServidor,
} from './apiSistema'

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

const recursos = {
  generadoEn: '2026-11-22T12:00:00.000Z',
  disco: { totalBytes: 8000000000, usadoBytes: 3000000000 },
  memoria: {
    totalBytes: 2000000000,
    disponibleBytes: 900000000,
    swapTotalBytes: 1000000000,
    swapUsadoBytes: 0,
  },
  cpu: { nucleos: 1, carga1: 0.2, carga5: 0.1, carga15: 0.1 },
  baseDatos: { totalBytes: 9000000, lecturasBytes: 4000000 },
  certificado: { venceEn: '2026-12-18T12:00:00.000Z', diasRestantes: 26 },
  servicios: {
    baseDatosPanel: 'ok',
    baseDatosLecturas: 'ok',
    apiReceptora: 'ok',
  },
}

describe('obtenerServidor', () => {
  it('pide el estado del servidor y lo entrega', async () => {
    responder(200, recursos)
    expect(await obtenerServidor()).toEqual({ ok: true, recursos })
    expect(fetch).toHaveBeenCalledWith(
      '/api/panel/sistema/servidor',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('acepta mediciones en null', async () => {
    const parcial = { ...recursos, disco: null, certificado: null, cpu: null }
    responder(200, parcial)
    expect(await obtenerServidor()).toEqual({ ok: true, recursos: parcial })
  })

  it('el 401 se toma como sesión caducada', async () => {
    responder(401, { error: 'x' })
    expect(await obtenerServidor()).toEqual({ ok: false, motivo: 'sesion' })
  })

  it('el 403 (no es administrador) se toma como fallo', async () => {
    responder(403, { error: 'Prohibido' })
    expect(await obtenerServidor()).toEqual({ ok: false, motivo: 'fallo' })
  })

  it('una respuesta con otra forma se toma como fallo', async () => {
    responder(200, { ...recursos, servicios: { baseDatosPanel: 'ok' } })
    expect(await obtenerServidor()).toEqual({ ok: false, motivo: 'fallo' })
    responder(200, { ...recursos, disco: { totalBytes: 'mucho' } })
    expect(await obtenerServidor()).toEqual({ ok: false, motivo: 'fallo' })
  })

  it('si la red falla, regresa fallo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin red')))
    expect(await obtenerServidor()).toEqual({ ok: false, motivo: 'fallo' })
  })
})
