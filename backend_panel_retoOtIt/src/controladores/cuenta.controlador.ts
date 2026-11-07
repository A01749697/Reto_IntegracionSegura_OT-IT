// Recibe las peticiones de "Mi cuenta" y responde.
import type { Request, Response } from 'express'
import { validarCambiarContrasena } from '../esquemas/autenticacion.esquema'
import { sesionDe } from '../intermediarios/sesion.intermediario'
import type { ServicioCuenta } from '../servicios/cuenta.servicio'

const RESPUESTAS = {
  no_existe: { status: 404, error: 'La cuenta no existe' },
  bloqueada: {
    status: 429,
    error: 'Demasiados intentos fallidos. Intenta de nuevo más tarde.',
  },
  actual_incorrecta: {
    status: 403,
    error: 'La contraseña actual no es correcta',
  },
} as const

export function crearControladorCuenta(servicio: ServicioCuenta) {
  return {
    async cambiarContrasena(req: Request, res: Response) {
      const validacion = validarCambiarContrasena(req.body)
      if (!validacion.ok) {
        res.status(400).json({ error: validacion.error })
        return
      }
      const { usuarioId, sesionId } = sesionDe(res)
      const resultado = await servicio.cambiarContrasena(
        usuarioId,
        sesionId,
        validacion.datos,
        req.ip ?? null,
      )
      if (!resultado.ok) {
        const { status, error } = RESPUESTAS[resultado.motivo]
        res.status(status).json({ error, codigo: resultado.motivo })
        return
      }
      res.json({
        mensaje: 'Tu contraseña se cambió. Cerramos tus otras sesiones.',
      })
    },
  }
}

export type ControladorCuenta = ReturnType<typeof crearControladorCuenta>
