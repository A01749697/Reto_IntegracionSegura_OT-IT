// Responde los errores sin enseñarle detalles internos al cliente.
import type { NextFunction, Request, Response } from 'express'

type ErrorHttp = { status?: number; type?: string }

export function rutaNoEncontrada(_req: Request, res: Response) {
  res.status(404).json({ error: 'No encontrado' })
}

// Express reconoce un manejador de errores por sus 4 parámetros, aunque no se use _next.
export function manejarErrores(
  error: ErrorHttp,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (error.type === 'entity.too.large') {
    res.status(413).json({ error: 'Cuerpo demasiado grande' })
    return
  }
  if (error.status && error.status >= 400 && error.status < 500) {
    res.status(400).json({ error: 'Solicitud inválida' })
    return
  }
  // El detalle se queda en el registro del servidor y nunca llega al cliente.
  console.error(error)
  res.status(500).json({ error: 'Error interno' })
}
