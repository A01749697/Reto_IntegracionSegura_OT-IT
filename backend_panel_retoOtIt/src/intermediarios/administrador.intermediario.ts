// Revisa que la sesión sea de un administrador. Va siempre después de exigirSesion.
import type { NextFunction, Request, Response } from 'express'
import type { SesionActiva } from '../repositorios/sesiones.repositorio'

export function exigirAdministrador(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  const sesion = res.locals.sesion as SesionActiva | undefined
  // Si por un error de configuración no hay sesión, también se niega: falla cerrado.
  if (sesion?.rol !== 'administrador') {
    res.status(403).json({ error: 'Prohibido' })
    return
  }
  next()
}
