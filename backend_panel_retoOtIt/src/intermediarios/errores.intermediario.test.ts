import express from 'express'
import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { manejarErrores, rutaNoEncontrada } from './errores.intermediario'

function crearApp() {
  const app = express()
  app.use(express.json())
  app.get('/grande', () => {
    throw Object.assign(new Error('x'), {
      type: 'entity.too.large',
      status: 413,
    })
  })
  app.get('/mala', () => {
    throw Object.assign(new Error('x'), { status: 400 })
  })
  app.get('/falla', () => {
    throw new Error('secreto-interno')
  })
  app.post('/json', (_req, res) => {
    res.json({ ok: true })
  })
  app.use(rutaNoEncontrada)
  app.use(manejarErrores)
  return app
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('manejo de errores', () => {
  it('responde 404 en una ruta que no existe', async () => {
    const respuesta = await request(crearApp()).get('/no-existe')
    expect(respuesta.status).toBe(404)
    expect(respuesta.body).toEqual({ error: 'No encontrado' })
  })

  it('responde 413 cuando el cuerpo es demasiado grande', async () => {
    const respuesta = await request(crearApp()).get('/grande')
    expect(respuesta.status).toBe(413)
    expect(respuesta.body).toEqual({ error: 'Cuerpo demasiado grande' })
  })

  it('responde 400 con un mensaje genérico en errores del cliente', async () => {
    const respuesta = await request(crearApp()).get('/mala')
    expect(respuesta.status).toBe(400)
    expect(respuesta.body).toEqual({ error: 'Solicitud inválida' })
  })

  it('responde 400 cuando el JSON está mal escrito', async () => {
    const respuesta = await request(crearApp())
      .post('/json')
      .set('Content-Type', 'application/json')
      .send('{"mal":')
    expect(respuesta.status).toBe(400)
    expect(respuesta.body).toEqual({ error: 'Solicitud inválida' })
  })

  it('responde 500 sin enseñar el detalle y lo deja en el registro del servidor', async () => {
    const registro = vi.spyOn(console, 'error').mockImplementation(() => {})

    const respuesta = await request(crearApp()).get('/falla')

    expect(respuesta.status).toBe(500)
    expect(respuesta.body).toEqual({ error: 'Error interno' })
    expect(JSON.stringify(respuesta.body)).not.toContain('secreto-interno')
    expect(registro).toHaveBeenCalled()
  })
})
