import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import type { SesionActiva } from '../repositorios/sesiones.repositorio'
import { exigirAdministrador } from './administrador.intermediario'

function crearSesion(rol: SesionActiva['rol']): SesionActiva {
  return {
    sesionId: 1,
    usuarioId: 1,
    nombre: 'Ana',
    correo: 'ana@ejemplo.com',
    rol,
  }
}

// Simula lo que haría exigirSesion: deja la sesión (o nada) en res.locals.
function crearApp(sesion?: SesionActiva) {
  const app = express()
  app.get(
    '/admin',
    (_req, res, next) => {
      if (sesion) res.locals.sesion = sesion
      next()
    },
    exigirAdministrador,
    (_req, res) => {
      res.json({ ok: true })
    },
  )
  return app
}

describe('exigirAdministrador', () => {
  it('deja pasar a un administrador', async () => {
    const respuesta = await request(crearApp(crearSesion('administrador'))).get(
      '/admin',
    )
    expect(respuesta.status).toBe(200)
  })

  it('niega a un usuario normal con 403', async () => {
    const respuesta = await request(crearApp(crearSesion('usuario'))).get(
      '/admin',
    )
    expect(respuesta.status).toBe(403)
    expect(respuesta.body).toEqual({ error: 'Prohibido' })
  })

  it('niega si no hay sesión (falla cerrado)', async () => {
    const respuesta = await request(crearApp()).get('/admin')
    expect(respuesta.status).toBe(403)
  })
})
