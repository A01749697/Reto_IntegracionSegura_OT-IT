import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { crearAplicacion } from './aplicacion'
import type { Lectura } from './esquemas/lecturas.esquema'

const TOKEN = 'a'.repeat(64)
const AHORA = Date.parse('2026-10-28T16:00:00Z')

const lecturaValida = {
  ts: '2026-10-28T15:59:00Z',
  plc: 'S7-1500',
  variable: 'contador_piezas',
  valor: 42,
}

function prepararApp() {
  const guardarLecturas = vi
    .fn<(lecturas: Lectura[]) => Promise<void>>()
    .mockResolvedValue(undefined)
  const app = crearAplicacion({
    token: TOKEN,
    guardarLecturas,
    ahora: () => AHORA,
  })
  return { app, guardarLecturas }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GET /api/ingest/salud', () => {
  it('responde ok sin pedir token', async () => {
    const { app } = prepararApp()
    const respuesta = await request(app).get('/api/ingest/salud')
    expect(respuesta.status).toBe(200)
    expect(respuesta.body).toEqual({ estado: 'ok' })
  })
})

describe('POST /api/ingest/lecturas: token', () => {
  it('responde 401 sin token y no guarda nada', async () => {
    const { app, guardarLecturas } = prepararApp()
    const respuesta = await request(app)
      .post('/api/ingest/lecturas')
      .send({ lecturas: [lecturaValida] })
    expect(respuesta.status).toBe(401)
    expect(guardarLecturas).not.toHaveBeenCalled()
  })

  it('responde 401 con un token incorrecto', async () => {
    const { app, guardarLecturas } = prepararApp()
    const respuesta = await request(app)
      .post('/api/ingest/lecturas')
      .set('X-API-Token', 'b'.repeat(64))
      .send({ lecturas: [lecturaValida] })
    expect(respuesta.status).toBe(401)
    expect(guardarLecturas).not.toHaveBeenCalled()
  })

  it('revisa el token antes de leer el cuerpo (401 aunque el cuerpo sea enorme)', async () => {
    const { app } = prepararApp()
    const respuesta = await request(app)
      .post('/api/ingest/lecturas')
      .send({ relleno: 'x'.repeat(200_000) })
    expect(respuesta.status).toBe(401)
  })
})

describe('POST /api/ingest/lecturas: envíos válidos', () => {
  it('responde 201 y guarda un envío válido', async () => {
    const { app, guardarLecturas } = prepararApp()
    const respuesta = await request(app)
      .post('/api/ingest/lecturas')
      .set('X-API-Token', TOKEN)
      .send({ lecturas: [lecturaValida] })
    expect(respuesta.status).toBe(201)
    expect(respuesta.body).toEqual({ recibidas: 1 })
    expect(guardarLecturas).toHaveBeenCalledTimes(1)
    const guardadas = guardarLecturas.mock.calls[0]?.[0]
    expect(guardadas).toHaveLength(1)
    expect(guardadas?.[0]?.variable).toBe('contador_piezas')
    expect(guardadas?.[0]?.ts).toEqual(new Date('2026-10-28T15:59:00Z'))
  })

  it('acepta 500 lecturas en un solo envío', async () => {
    const { app, guardarLecturas } = prepararApp()
    const respuesta = await request(app)
      .post('/api/ingest/lecturas')
      .set('X-API-Token', TOKEN)
      .send({ lecturas: Array(500).fill(lecturaValida) })
    expect(respuesta.status).toBe(201)
    expect(respuesta.body).toEqual({ recibidas: 500 })
    expect(guardarLecturas).toHaveBeenCalledTimes(1)
  })
})

describe('POST /api/ingest/lecturas: envíos inválidos', () => {
  const casos: [string, unknown][] = [
    ['más de 500 lecturas', { lecturas: Array(501).fill(lecturaValida) }],
    ['lista vacía', { lecturas: [] }],
    ['un campo extra en el cuerpo', { lecturas: [lecturaValida], extra: 1 }],
    [
      'un campo extra en una lectura',
      { lecturas: [{ ...lecturaValida, extra: 1 }] },
    ],
    ['PLC no permitido', { lecturas: [{ ...lecturaValida, plc: 'S7-9999' }] }],
    [
      'variable no permitida',
      { lecturas: [{ ...lecturaValida, variable: 'otra' }] },
    ],
    [
      'valor que no es número',
      { lecturas: [{ ...lecturaValida, valor: '42' }] },
    ],
    [
      'fecha sin zona horaria',
      { lecturas: [{ ...lecturaValida, ts: '2026-10-28T15:59:00' }] },
    ],
    [
      'fecha en el futuro lejano',
      { lecturas: [{ ...lecturaValida, ts: '2026-10-28T16:30:00Z' }] },
    ],
    [
      'fecha de hace más de 7 días',
      { lecturas: [{ ...lecturaValida, ts: '2026-10-20T16:00:00Z' }] },
    ],
    [
      'una variable no permitida entre lecturas válidas',
      {
        lecturas: [lecturaValida, { ...lecturaValida, variable: 'otra' }],
      },
    ],
  ]

  it.each(casos)(
    'responde 400 y no guarda nada con %s',
    async (_nombre, cuerpo) => {
      const { app, guardarLecturas } = prepararApp()
      const respuesta = await request(app)
        .post('/api/ingest/lecturas')
        .set('X-API-Token', TOKEN)
        .send(cuerpo as object)
      expect(respuesta.status).toBe(400)
      expect(typeof respuesta.body.error).toBe('string')
      expect(guardarLecturas).not.toHaveBeenCalled()
    },
  )

  it('indica cuál lectura falló', async () => {
    const { app } = prepararApp()
    const respuesta = await request(app)
      .post('/api/ingest/lecturas')
      .set('X-API-Token', TOKEN)
      .send({
        lecturas: [lecturaValida, { ...lecturaValida, variable: 'otra' }],
      })
    expect(respuesta.body.error).toBe('lecturas[1]: variable no permitida')
  })

  it('responde 400 si el cuerpo no es JSON', async () => {
    const { app } = prepararApp()
    const respuesta = await request(app)
      .post('/api/ingest/lecturas')
      .set('X-API-Token', TOKEN)
      .set('Content-Type', 'text/plain')
      .send('hola')
    expect(respuesta.status).toBe(400)
  })

  it('responde 400 si el JSON está mal formado', async () => {
    const { app } = prepararApp()
    const respuesta = await request(app)
      .post('/api/ingest/lecturas')
      .set('X-API-Token', TOKEN)
      .set('Content-Type', 'application/json')
      .send('{"lecturas": [')
    expect(respuesta.status).toBe(400)
  })

  it('responde 413 si el cuerpo pasa de 100 KB', async () => {
    const { app, guardarLecturas } = prepararApp()
    const respuesta = await request(app)
      .post('/api/ingest/lecturas')
      .set('X-API-Token', TOKEN)
      .send({ lecturas: [{ ...lecturaValida, variable: 'x'.repeat(200_000) }] })
    expect(respuesta.status).toBe(413)
    expect(guardarLecturas).not.toHaveBeenCalled()
  })
})

describe('errores internos y rutas desconocidas', () => {
  it('responde 500 sin detalles internos cuando falla la base de datos', async () => {
    const registro = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { app, guardarLecturas } = prepararApp()
    guardarLecturas.mockRejectedValue(
      new Error('secreto interno: password=123'),
    )

    const respuesta = await request(app)
      .post('/api/ingest/lecturas')
      .set('X-API-Token', TOKEN)
      .send({ lecturas: [lecturaValida] })

    expect(respuesta.status).toBe(500)
    expect(respuesta.body).toEqual({ error: 'Error interno' })
    expect(JSON.stringify(respuesta.body)).not.toContain('secreto')
    expect(registro).toHaveBeenCalled()
  })

  it('responde 404 en una ruta que no existe', async () => {
    const { app } = prepararApp()
    const respuesta = await request(app).get('/api/ingest/otra')
    expect(respuesta.status).toBe(404)
  })

  it('no anuncia que usa Express', async () => {
    const { app } = prepararApp()
    const respuesta = await request(app).get('/api/ingest/salud')
    expect(respuesta.headers['x-powered-by']).toBeUndefined()
  })
})
