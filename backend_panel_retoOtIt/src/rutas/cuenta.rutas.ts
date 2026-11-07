// Define qué URL existe para "Mi cuenta". Todas exigen sesión.
import express, { Router, type RequestHandler } from 'express'
import { seguridad } from '../configuracion/seguridad'
import type { ControladorCuenta } from '../controladores/cuenta.controlador'

type Dependencias = {
  controlador: ControladorCuenta
  exigirSesion: RequestHandler
  limitador: RequestHandler
}

export function crearRutasCuenta({
  controlador,
  exigirSesion,
  limitador,
}: Dependencias) {
  const rutas = Router()
  rutas.post(
    '/contrasena',
    exigirSesion,
    limitador,
    express.json({ limit: seguridad.peticion.limiteCuerpo }),
    controlador.cambiarContrasena,
  )
  return rutas
}
