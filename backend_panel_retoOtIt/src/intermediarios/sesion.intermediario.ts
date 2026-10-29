// Revisa que la petición traiga una sesión válida en la cookie.
import type { NextFunction, Request, Response } from 'express'
import type { SesionActiva } from '../repositorios/sesiones.repositorio'
import { leerCookie } from '../utilidades/cookies'

type Dependencias = {
  nombreCookie: string
  validarSesion: (token: string | undefined) => Promise<SesionActiva | null>
}

export function exigirSesion({ nombreCookie, validarSesion }: Dependencias) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Lo que pasa por aquí es privado: que ningún navegador ni intermediario lo guarde.
    res.set('Cache-Control', 'no-store')

    const sesion = await validarSesion(
      leerCookie(req.get('Cookie'), nombreCookie),
    )
    if (sesion === null) {
      res.status(401).json({ error: 'No autorizado' })
      return
    }
    // Los controladores leen la sesión con sesionDe(res).
    res.locals.sesion = sesion
    next()
  }
}

export function sesionDe(res: Response): SesionActiva {
  return res.locals.sesion as SesionActiva
}
