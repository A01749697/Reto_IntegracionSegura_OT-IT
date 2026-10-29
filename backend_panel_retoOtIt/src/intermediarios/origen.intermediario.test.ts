import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { exigirOrigenPropio } from './origen.intermediario'

const ORIGEN = 'https://18.119.219.73'

function crearApp() {
  const app = express()
  app.use(exigirOrigenPropio(ORIGEN))
  app.all('/recurso', (_req, res) => {
    res.json({ ok: true })
  })
  return app
}

describe('exigirOrigenPropio', () => {
  it('deja pasar las lecturas sin Origin', async () => {
    const respuesta = await request(crearApp()).get('/recurso')
    expect(respuesta.status).toBe(200)
  })

  it.each(['post', 'put', 'patch', 'delete'] as const)(
    '%s con el Origin correcto pasa',
    async (metodo) => {
      const agente = request(crearApp())
      const respuesta = await agente[metodo]('/recurso').set('Origin', ORIGEN)
      expect(respuesta.status).toBe(200)
    },
  )

  it.each(['post', 'put', 'patch', 'delete'] as const)(
    '%s sin Origin se rechaza',
    async (metodo) => {
      const respuesta = await request(crearApp())[metodo]('/recurso')
      expect(respuesta.status).toBe(403)
      expect(respuesta.body).toEqual({ error: 'Prohibido' })
    },
  )

  it.each([
    'https://sitio-malo.com',
    'http://18.119.219.73',
    'https://18.119.219.73.sitio-malo.com',
    'https://18.119.219.73:8443',
    'null',
  ])('post con Origin %j se rechaza', async (origen) => {
    const respuesta = await request(crearApp())
      .post('/recurso')
      .set('Origin', origen)
    expect(respuesta.status).toBe(403)
  })
})
