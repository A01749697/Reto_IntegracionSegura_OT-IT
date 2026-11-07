import type { Request, Response } from 'express'
import type { ServicioBitacora } from '../servicios/bitacora.servicio'

export function crearControladorBitacora(servicio: ServicioBitacora) {
  return {
    async listar(req: Request, res: Response) {
      const resultado = await servicio.listar(req.query)
      if (!resultado.ok) {
        res.status(400).json({ error: resultado.error })
        return
      }
      res.json({ eventos: resultado.eventos, hayMas: resultado.hayMas })
    },
  }
}

export type ControladorBitacora = ReturnType<typeof crearControladorBitacora>
