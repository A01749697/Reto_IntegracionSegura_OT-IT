// Recibe las peticiones de la pantalla de administrador y responde.
import type { Request, Response } from 'express'
import {
  validarDecision,
  validarEstadoLista,
  validarIdUsuario,
} from '../esquemas/administracion.esquema'
import { sesionDe } from '../intermediarios/sesion.intermediario'
import type { ServicioAdministracion } from '../servicios/administracion.servicio'

const RESPUESTAS_DECISION = {
  no_existe: { status: 404, error: 'La cuenta no existe' },
  es_propia: {
    status: 403,
    error: 'No puedes decidir sobre tu propia cuenta',
  },
  es_administrador: {
    status: 403,
    error: 'Las cuentas de administrador no se cambian desde el panel',
  },
  sin_cambio: { status: 409, error: 'La cuenta ya tiene ese estado' },
} as const

const RESPUESTAS_DESBLOQUEO = {
  no_existe: { status: 404, error: 'La cuenta no existe' },
  sin_cambio: { status: 409, error: 'La cuenta no está bloqueada' },
} as const

const RESPUESTAS_PROMOCION = {
  no_existe: { status: 404, error: 'La cuenta no existe' },
  sin_cambio: { status: 409, error: 'La cuenta ya es administradora' },
  no_aprobada: {
    status: 409,
    error: 'Solo se puede promover una cuenta aprobada',
  },
} as const

export function crearControladorAdministracion(
  servicio: ServicioAdministracion,
) {
  return {
    async listar(req: Request, res: Response) {
      const validacion = validarEstadoLista(req.query)
      if (!validacion.ok) {
        res.status(400).json({ error: validacion.error })
        return
      }
      const usuarios = await servicio.listar(validacion.datos)
      res.json({ usuarios })
    },

    async decidir(req: Request, res: Response) {
      const id = validarIdUsuario(req.params.id)
      if (!id.ok) {
        res.status(400).json({ error: id.error })
        return
      }
      const decision = validarDecision(req.body)
      if (!decision.ok) {
        res.status(400).json({ error: decision.error })
        return
      }

      const resultado = await servicio.decidir(
        id.datos,
        decision.datos,
        sesionDe(res).usuarioId,
        req.ip ?? null,
      )
      if (!resultado.ok) {
        const { status, error } = RESPUESTAS_DECISION[resultado.motivo]
        res.status(status).json({ error })
        return
      }
      res.json({
        mensaje:
          decision.datos === 'aprobado'
            ? 'Cuenta aprobada'
            : 'Cuenta rechazada',
      })
    },

    async desbloquear(req: Request, res: Response) {
      const id = validarIdUsuario(req.params.id)
      if (!id.ok) {
        res.status(400).json({ error: id.error })
        return
      }
      const resultado = await servicio.desbloquear(
        id.datos,
        sesionDe(res).usuarioId,
        req.ip ?? null,
      )
      if (!resultado.ok) {
        const { status, error } = RESPUESTAS_DESBLOQUEO[resultado.motivo]
        res.status(status).json({ error })
        return
      }
      res.json({ mensaje: 'Cuenta desbloqueada' })
    },

    async hacerAdministrador(req: Request, res: Response) {
      const id = validarIdUsuario(req.params.id)
      if (!id.ok) {
        res.status(400).json({ error: id.error })
        return
      }
      const resultado = await servicio.hacerAdministrador(
        id.datos,
        sesionDe(res).usuarioId,
        req.ip ?? null,
      )
      if (!resultado.ok) {
        const { status, error } = RESPUESTAS_PROMOCION[resultado.motivo]
        res.status(status).json({ error })
        return
      }
      res.json({ mensaje: 'La cuenta ahora es administradora' })
    },
  }
}

export type ControladorAdministracion = ReturnType<
  typeof crearControladorAdministracion
>
