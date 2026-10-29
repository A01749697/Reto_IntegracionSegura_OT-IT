// Arma la aplicación de Express conectando las capas.
// No abre ningún puerto, por eso las pruebas pueden usarla directamente.
import express from 'express'
import { crearControladorLecturas } from './controladores/lecturas.controlador'
import type { Lectura } from './esquemas/lecturas.esquema'
import {
  manejarErrores,
  rutaNoEncontrada,
} from './intermediarios/errores.intermediario'
import { crearRutasLecturas } from './rutas/lecturas.rutas'
import { crearServicioLecturas } from './servicios/lecturas.servicio'

export type Dependencias = {
  token: string
  guardarLecturas: (lecturas: Lectura[]) => Promise<void>
  ahora?: () => number
}

export function crearAplicacion({
  token,
  guardarLecturas,
  ahora = Date.now,
}: Dependencias) {
  const servicio = crearServicioLecturas({ guardarLecturas, ahora })
  const controlador = crearControladorLecturas(servicio)

  const app = express()
  app.disable('x-powered-by')

  // nginx le pasa a la API la ruta completa, por eso el prefijo es /api/ingest.
  app.use('/api/ingest', crearRutasLecturas({ token, controlador }))

  app.use(rutaNoEncontrada)
  app.use(manejarErrores)
  return app
}
