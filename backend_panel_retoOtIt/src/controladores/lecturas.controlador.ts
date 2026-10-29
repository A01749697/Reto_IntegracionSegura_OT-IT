// Recibe las peticiones del dashboard, le pide el trabajo al servicio y responde.
import type { Request, Response } from 'express'
import type { ServicioLecturas } from '../servicios/lecturas.servicio'

export function crearControladorLecturas(servicio: ServicioLecturas) {
  return {
    async ultimas(_req: Request, res: Response) {
      const lecturas = await servicio.ultimas()
      res.json({ lecturas })
    },

    async historial(req: Request, res: Response) {
      const resultado = await servicio.historial(req.query)
      if (!resultado.ok) {
        res.status(400).json({ error: resultado.error })
        return
      }
      res.json({ puntos: resultado.puntos, truncado: resultado.truncado })
    },
  }
}

export type ControladorLecturas = ReturnType<typeof crearControladorLecturas>
