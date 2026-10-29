// Recibe la petición HTTP, le pide el trabajo al servicio y responde.
import type { Request, Response } from 'express'
import type { ServicioLecturas } from '../servicios/lecturas.servicio'

export function crearControladorLecturas(servicio: ServicioLecturas) {
  return {
    salud(_req: Request, res: Response) {
      res.json({ estado: 'ok' })
    },

    async crearLecturas(req: Request, res: Response) {
      const resultado = await servicio.registrar(req.body)
      if (!resultado.ok) {
        res.status(400).json({ error: resultado.error })
        return
      }
      res.status(201).json({ recibidas: resultado.recibidas })
    },
  }
}

export type ControladorLecturas = ReturnType<typeof crearControladorLecturas>
