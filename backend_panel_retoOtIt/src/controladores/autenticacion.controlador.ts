// Recibe las peticiones de cuenta y sesión, le pide el trabajo a los servicios y responde.
import type { Request, Response } from 'express'
import { seguridad } from '../configuracion/seguridad'
import {
  validarCrearCuenta,
  validarEntrar,
  validarPedirReinicio,
  validarUsarEnlace,
} from '../esquemas/autenticacion.esquema'
import { sesionDe } from '../intermediarios/sesion.intermediario'
import type { ServicioAutenticacion } from '../servicios/autenticacion.servicio'
import type { ServicioReinicio } from '../servicios/reinicio.servicio'
import type { ServicioSesion } from '../servicios/sesion.servicio'
import {
  crearCookieBorrada,
  crearCookieSesion,
  leerCookie,
} from '../utilidades/cookies'

type Dependencias = {
  autenticacion: ServicioAutenticacion
  reinicio: ServicioReinicio
  sesion: ServicioSesion
}

const RESPUESTAS_ENTRAR = {
  credenciales_invalidas: {
    status: 401,
    error: 'Correo o contraseña incorrectos',
  },
  bloqueada: {
    status: 429,
    error: 'Demasiados intentos fallidos. Intenta de nuevo más tarde.',
  },
  pendiente: {
    status: 403,
    error: 'Tu cuenta aún está pendiente de aprobación',
  },
  rechazada: { status: 403, error: 'Tu cuenta no fue aprobada' },
} as const

export function crearControladorAutenticacion({
  autenticacion,
  reinicio,
  sesion,
}: Dependencias) {
  return {
    async crearCuenta(req: Request, res: Response) {
      const validacion = validarCrearCuenta(req.body)
      if (!validacion.ok) {
        res.status(400).json({ error: validacion.error })
        return
      }
      await autenticacion.crearCuenta(validacion.datos)
      // La misma respuesta exista o no el correo, para no revelar qué correos están registrados.
      res.status(202).json({
        mensaje: 'Recibimos tu solicitud. Un administrador la revisará.',
      })
    },

    async entrar(req: Request, res: Response) {
      const validacion = validarEntrar(req.body)
      if (!validacion.ok) {
        res.status(400).json({ error: validacion.error })
        return
      }
      const resultado = await autenticacion.entrar(validacion.datos)
      if (!resultado.ok) {
        const { status, error } = RESPUESTAS_ENTRAR[resultado.motivo]
        res.status(status).json({ error, codigo: resultado.motivo })
        return
      }
      res.setHeader(
        'Set-Cookie',
        crearCookieSesion(
          seguridad.sesion.nombreCookie,
          resultado.token,
          Math.floor(seguridad.sesion.duracionMaximaMs / 1000),
        ),
      )
      res.json({ usuario: resultado.usuario })
    },

    async olvide(req: Request, res: Response) {
      const validacion = validarPedirReinicio(req.body)
      if (!validacion.ok) {
        res.status(400).json({ error: validacion.error })
        return
      }
      await reinicio.pedir(validacion.datos.correo)
      res.status(202).json({
        mensaje:
          'Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña.',
      })
    },

    async restablecer(req: Request, res: Response) {
      const validacion = validarUsarEnlace(req.body)
      if (!validacion.ok) {
        res.status(400).json({ error: validacion.error })
        return
      }
      const cambiada = await reinicio.restablecer(validacion.datos)
      if (!cambiada) {
        res.status(400).json({ error: 'El enlace no es válido o ya caducó' })
        return
      }
      res.json({
        mensaje: 'Tu contraseña se cambió. Ya puedes iniciar sesión.',
      })
    },

    // No exige sesión: si ya caducó, igual hay que poder limpiar la cookie.
    async salir(req: Request, res: Response) {
      await sesion.cerrar(
        leerCookie(req.get('Cookie'), seguridad.sesion.nombreCookie),
      )
      res.setHeader(
        'Set-Cookie',
        crearCookieBorrada(seguridad.sesion.nombreCookie),
      )
      res.status(204).end()
    },

    yo(_req: Request, res: Response) {
      const { usuarioId, nombre, correo, rol } = sesionDe(res)
      res.json({ usuario: { id: usuarioId, nombre, correo, rol } })
    },
  }
}

export type ControladorAutenticacion = ReturnType<
  typeof crearControladorAutenticacion
>
