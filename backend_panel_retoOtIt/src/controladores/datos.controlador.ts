import type { Request, Response } from 'express'
import { validarConsultaDatos, validarTabla } from '../esquemas/datos.esquema'
import { sesionDe } from '../intermediarios/sesion.intermediario'
import type { ServicioDatos } from '../servicios/datos.servicio'

export function crearControladorDatos(servicio: ServicioDatos) {
  return {
    tablas(_req: Request, res: Response) {
      res.json({ tablas: servicio.catalogo() })
    },

    async consultar(req: Request, res: Response) {
      const tabla = validarTabla(req.params.tabla)
      if (!tabla.ok) {
        res.status(404).json({ error: tabla.error })
        return
      }
      const consulta = validarConsultaDatos(req.query)
      if (!consulta.ok) {
        res.status(400).json({ error: consulta.error })
        return
      }
      const { usuarioId, correo } = sesionDe(res)
      const pagina = await servicio.consultar(tabla.datos, consulta.datos, {
        usuarioId,
        correo,
        ip: req.ip ?? null,
      })
      res.json(pagina)
    },
  }
}

export type ControladorDatos = ReturnType<typeof crearControladorDatos>
