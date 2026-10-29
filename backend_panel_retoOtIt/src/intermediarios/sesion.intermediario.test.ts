import express from 'express'
import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SesionActiva } from '../repositorios/sesiones.repositorio'
import { manejarErrores } from './errores.intermediario'
import { exigirSesion, sesionDe } from './sesion.intermediario'

const sesionFalsa: SesionActiva = {
  sesionId: 7,
  usuarioId: 3,
  nombre: 'Ana',
  correo: 'ana@ejemplo.com',
  rol: 'usuario',
}

function crearApp(
  validarSesion: (token: string | undefined) => Promise<SesionActiva | null>,
) {
  const app = express()
  app.get(
    '/privado',
    exigirSesion({ nombreCookie: 'sesion_prueba', validarSesion }),
    (_req, res) => {
      res.json({ nombre: sesionDe(res).nombre })
    },
  )
  app.use(manejarErrores)
  return app
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('exigirSesion', () => {
  it('sin cookie responde 401, no guarda en caché y pregunta con undefined', async () => {
    const validarSesion = vi.fn().mockResolvedValue(null)

    const respuesta = await request(crearApp(validarSesion)).get('/privado')

    expect(respuesta.status).toBe(401)
    expect(respuesta.body).toEqual({ error: 'No autorizado' })
    expect(respuesta.headers['cache-control']).toBe('no-store')
    expect(validarSesion).toHaveBeenCalledWith(undefined)
  })

  it('con una sesión válida deja pasar y los controladores ven los datos', async () => {
    const validarSesion = vi.fn().mockResolvedValue(sesionFalsa)

    const respuesta = await request(crearApp(validarSesion))
      .get('/privado')
      .set('Cookie', 'sesion_prueba=abc')

    expect(respuesta.status).toBe(200)
    expect(respuesta.body).toEqual({ nombre: 'Ana' })
    expect(respuesta.headers['cache-control']).toBe('no-store')
    expect(validarSesion).toHaveBeenCalledWith('abc')
  })

  it('usa la cookie correcta cuando hay varias', async () => {
    const validarSesion = vi.fn().mockResolvedValue(sesionFalsa)

    await request(crearApp(validarSesion))
      .get('/privado')
      .set('Cookie', 'otra=1; sesion_prueba=abc; mas=2')

    expect(validarSesion).toHaveBeenCalledWith('abc')
  })

  it('si la sesión no sirve responde 401', async () => {
    const validarSesion = vi.fn().mockResolvedValue(null)

    const respuesta = await request(crearApp(validarSesion))
      .get('/privado')
      .set('Cookie', 'sesion_prueba=abc')

    expect(respuesta.status).toBe(401)
  })

  it('si la base falla responde 500 sin detalles', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const validarSesion = vi
      .fn()
      .mockRejectedValue(new Error('secreto-interno'))

    const respuesta = await request(crearApp(validarSesion))
      .get('/privado')
      .set('Cookie', 'sesion_prueba=abc')

    expect(respuesta.status).toBe(500)
    expect(respuesta.body).toEqual({ error: 'Error interno' })
    expect(JSON.stringify(respuesta.body)).not.toContain('secreto-interno')
  })
})
