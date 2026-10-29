// Define qué URL existe y en qué orden se revisan las cosas.
import express, { Router } from 'express'
import { LIMITE_CUERPO } from '../configuracion/reglas'
import type { ControladorLecturas } from '../controladores/lecturas.controlador'
import { exigirToken } from '../intermediarios/autenticacion.intermediario'

type Dependencias = {
  token: string
  controlador: ControladorLecturas
}

export function crearRutasLecturas({ token, controlador }: Dependencias) {
  const rutas = Router()

  // Esta ruta no pide token porque no devuelve datos: solo dice si la API está viva.
  rutas.get('/salud', controlador.salud)

  // El token se revisa ANTES de leer el cuerpo.
  rutas.post(
    '/lecturas',
    exigirToken(token),
    express.json({ limit: LIMITE_CUERPO }),
    controlador.crearLecturas,
  )

  return rutas
}
