import type { Request, Response } from 'express'
import type { ServicioSistema } from '../servicios/sistema.servicio'

export function crearControladorSistema(servicio: ServicioSistema) {
  return {
    async estado(_req: Request, res: Response) {
      res.json(await servicio.estado())
    },

    async disponibilidad(req: Request, res: Response) {
      const resultado = await servicio.disponibilidad(req.query)
      if (!resultado.ok) {
        res.status(400).json({ error: resultado.error })
        return
      }
      res.json(resultado.disponibilidad)
    },
  }
}

export type ControladorSistema = ReturnType<typeof crearControladorSistema>
