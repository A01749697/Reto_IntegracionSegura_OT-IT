// Segunda barrera contra la falsificación de peticiones (CSRF).
// La primera es la cookie SameSite=Strict. Aquí, además, toda petición que cambia datos
// debe declarar que viene de nuestra propia página (encabezado Origin).
import type { NextFunction, Request, Response } from 'express'

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function exigirOrigenPropio(origenPermitido: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (METODOS_SEGUROS.has(req.method)) {
      next()
      return
    }
    if (req.get('Origin') !== origenPermitido) {
      res.status(403).json({ error: 'Prohibido' })
      return
    }
    next()
  }
}
