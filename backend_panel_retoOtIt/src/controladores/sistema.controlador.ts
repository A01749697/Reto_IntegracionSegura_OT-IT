import type { Request, Response } from 'express'
import type { ServicioSistema } from '../servicios/sistema.servicio'

export function crearControladorSistema(servicio: ServicioSistema) {
  return {
    async estado(_req: Request, res: Response) {
      res.json(await servicio.estado())
    },
  }
}

export type ControladorSistema = ReturnType<typeof crearControladorSistema>
