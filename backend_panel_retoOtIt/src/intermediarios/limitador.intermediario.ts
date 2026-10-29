// Limita cuántas peticiones puede hacer una misma IP en un rato.
// Se usa en entrar, crear cuenta y recuperar contraseña, para frenar a quien prueba contraseñas.
import { rateLimit } from 'express-rate-limit'

type Opciones = { ventanaMs: number; maximoPorIp: number }

export function crearLimitador({ ventanaMs, maximoPorIp }: Opciones) {
  return rateLimit({
    windowMs: ventanaMs,
    limit: maximoPorIp,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => {
      res
        .status(429)
        .json({ error: 'Demasiadas peticiones. Intenta más tarde.' })
    },
  })
}
