// Define qué URL existe para el dashboard. Todas las rutas de este archivo exigen sesión.
import { Router, type RequestHandler } from 'express'
import type { ControladorLecturas } from '../controladores/lecturas.controlador'

type Dependencias = {
  controlador: ControladorLecturas
  exigirSesion: RequestHandler
}

export function crearRutasLecturas({
  controlador,
  exigirSesion,
}: Dependencias) {
  const rutas = Router()

  rutas.use(exigirSesion)

  rutas.get('/ultimas', controlador.ultimas)
  rutas.get('/historial', controlador.historial)

  return rutas
}
