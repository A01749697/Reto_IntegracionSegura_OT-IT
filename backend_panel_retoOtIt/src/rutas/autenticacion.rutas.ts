// Define qué URL existe para cuentas y sesión, y en qué orden se revisan las cosas.
import express, { Router, type RequestHandler } from 'express'
import { seguridad } from '../configuracion/seguridad'
import type { ControladorAutenticacion } from '../controladores/autenticacion.controlador'

type Dependencias = {
  controlador: ControladorAutenticacion
  exigirSesion: RequestHandler
  limitador: RequestHandler
}

export function crearRutasAutenticacion({
  controlador,
  exigirSesion,
  limitador,
}: Dependencias) {
  const rutas = Router()
  const leerJson = express.json({ limit: seguridad.peticion.limiteCuerpo })

  // En las cuatro rutas sin sesión, primero el límite por IP y después se lee el cuerpo,
  // así quien abusa le cuesta muy poco trabajo al servidor.
  rutas.post('/cuenta', limitador, leerJson, controlador.crearCuenta)
  rutas.post('/entrar', limitador, leerJson, controlador.entrar)
  rutas.post('/olvide', limitador, leerJson, controlador.olvide)
  rutas.post('/restablecer', limitador, leerJson, controlador.restablecer)

  // No exige sesión: si ya caducó, igual hay que poder limpiar la cookie.
  rutas.post('/salir', controlador.salir)

  rutas.get('/yo', exigirSesion, controlador.yo)

  return rutas
}
