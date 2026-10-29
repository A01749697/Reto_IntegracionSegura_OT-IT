// Revisa que la petición traiga el token correcto en la cabecera X-API-Token.
import { createHash, timingSafeEqual } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

function huella(texto: string): Buffer {
  return createHash('sha256').update(texto).digest()
}

// Compara las huellas (hash) en tiempo constante, para que nadie pueda adivinar
// el token midiendo cuánto tarda la respuesta.
function tokenValido(recibido: string | undefined, esperado: string): boolean {
  if (!recibido) return false
  return timingSafeEqual(huella(recibido), huella(esperado))
}

export function exigirToken(tokenEsperado: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!tokenValido(req.get('X-API-Token'), tokenEsperado)) {
      res.status(401).json({ error: 'No autorizado' })
      return
    }
    next()
  }
}
