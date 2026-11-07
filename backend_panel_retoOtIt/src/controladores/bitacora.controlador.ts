import type { Request, Response } from 'express'
import { sesionDe } from '../intermediarios/sesion.intermediario'
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

    async exportar(req: Request, res: Response) {
      const { usuarioId, correo } = sesionDe(res)
      const resultado = await servicio.exportar(
        req.query,
        usuarioId,
        correo,
        req.ip ?? null,
      )
      if (!resultado.ok) {
        res.status(400).json({ error: resultado.error })
        return
      }
      const fecha = new Date().toISOString().slice(0, 10)
      res.set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="bitacora-${fecha}.csv"`,
        'X-Truncado': resultado.truncado ? 'si' : 'no',
      })
      res.send(resultado.csv)
    },
  }
}

export type ControladorBitacora = ReturnType<typeof crearControladorBitacora>
