import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { crearLimitador } from './limitador.intermediario'

function crearApp() {
  const app = express()
  // Igual que en producción: la IP real viene del encabezado que pone nginx.
  app.set('trust proxy', 1)
  app.use(crearLimitador({ ventanaMs: 60_000, maximoPorIp: 2 }))
  app.get('/recurso', (_req, res) => {
    res.json({ ok: true })
  })
  return app
}

describe('crearLimitador', () => {
  it('deja pasar hasta el máximo y después responde 429 con un mensaje genérico', async () => {
    const app = crearApp()
    const peticion = () =>
      request(app).get('/recurso').set('X-Forwarded-For', '1.1.1.1')

    expect((await peticion()).status).toBe(200)
    expect((await peticion()).status).toBe(200)

    const bloqueada = await peticion()
    expect(bloqueada.status).toBe(429)
    expect(bloqueada.body).toEqual({
      error: 'Demasiadas peticiones. Intenta más tarde.',
    })
  })

  it('cuenta por separado a cada IP', async () => {
    const app = crearApp()
    const desde = (ip: string) =>
      request(app).get('/recurso').set('X-Forwarded-For', ip)

    await desde('1.1.1.1')
    await desde('1.1.1.1')
    expect((await desde('1.1.1.1')).status).toBe(429)

    expect((await desde('2.2.2.2')).status).toBe(200)
  })
})
