// Define qué URL existe para la pantalla de administrador.
// Todas las rutas de este archivo exigen sesión y rol de administrador.
import express, { Router, type RequestHandler } from 'express'
import { seguridad } from '../configuracion/seguridad'
import type { ControladorAdministracion } from '../controladores/administracion.controlador'
import type { ControladorBitacora } from '../controladores/bitacora.controlador'
import { exigirAdministrador } from '../intermediarios/administrador.intermediario'

type Dependencias = {
  controlador: ControladorAdministracion
  controladorBitacora: ControladorBitacora
  exigirSesion: RequestHandler
}

export function crearRutasAdministracion({
  controlador,
  controladorBitacora,
  exigirSesion,
}: Dependencias) {
  const rutas = Router()

  // Primero la sesión, luego el rol, y solo después se lee el cuerpo.
  rutas.use(exigirSesion, exigirAdministrador)

  rutas.get('/usuarios', controlador.listar)
  rutas.get('/bitacora', controladorBitacora.listar)
  rutas.post(
    '/usuarios/:id/decision',
    express.json({ limit: seguridad.peticion.limiteCuerpo }),
    controlador.decidir,
  )

  return rutas
}
