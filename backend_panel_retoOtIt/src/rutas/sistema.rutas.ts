import { Router, type RequestHandler } from 'express'
import type { ControladorSistema } from '../controladores/sistema.controlador'

type Dependencias = {
  controlador: ControladorSistema
  exigirSesion: RequestHandler
}

export function crearRutasSistema({ controlador, exigirSesion }: Dependencias) {
  const rutas = Router()
  rutas.use(exigirSesion)
  rutas.get('/estado', controlador.estado)
  return rutas
}
