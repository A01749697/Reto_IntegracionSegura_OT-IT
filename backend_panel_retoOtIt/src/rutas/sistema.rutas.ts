import { Router, type RequestHandler } from 'express'
import { exigirAdministrador } from '../intermediarios/administrador.intermediario'
import type { ControladorSistema } from '../controladores/sistema.controlador'

type Dependencias = {
  controlador: ControladorSistema
  exigirSesion: RequestHandler
}

export function crearRutasSistema({ controlador, exigirSesion }: Dependencias) {
  const rutas = Router()
  rutas.use(exigirSesion)
  rutas.get('/estado', controlador.estado)
  rutas.get('/disponibilidad', controlador.disponibilidad)
  // Salud del servidor: solo para administradores.
  rutas.get('/servidor', exigirAdministrador, controlador.recursos)
  return rutas
}
