// Arma la aplicación de Express conectando las capas.
// No abre ningún puerto, por eso las pruebas pueden usarla directamente.
import express, { Router } from 'express'
import { seguridad } from './configuracion/seguridad'
import { crearControladorAdministracion } from './controladores/administracion.controlador'
import { crearControladorAutenticacion } from './controladores/autenticacion.controlador'
import { crearControladorLecturas } from './controladores/lecturas.controlador'
import {
  manejarErrores,
  rutaNoEncontrada,
} from './intermediarios/errores.intermediario'
import { crearLimitador } from './intermediarios/limitador.intermediario'
import { exigirOrigenPropio } from './intermediarios/origen.intermediario'
import { exigirSesion } from './intermediarios/sesion.intermediario'
import { crearRutasAdministracion } from './rutas/administracion.rutas'
import { crearRutasAutenticacion } from './rutas/autenticacion.rutas'
import { crearRutasLecturas } from './rutas/lecturas.rutas'
import { crearServicioAdministracion } from './servicios/administracion.servicio'
import { crearServicioAutenticacion } from './servicios/autenticacion.servicio'
import { crearServicioCorreo } from './servicios/correo.servicio'
import { crearServicioLecturas } from './servicios/lecturas.servicio'
import { crearServicioReinicio } from './servicios/reinicio.servicio'
import { crearServicioSesion } from './servicios/sesion.servicio'

type De<F extends (...args: never[]) => unknown> = Parameters<F>[0]

// Lo que cada servicio necesita de afuera. Lo que un servicio recibe de otro
// servicio (por ejemplo iniciarSesion) se conecta aquí adentro y no se pide.
export type Dependencias = {
  urlPublica: string
  sesion: De<typeof crearServicioSesion>
  autenticacion: Omit<
    De<typeof crearServicioAutenticacion>,
    'iniciarSesion' | 'ahora'
  >
  reinicio: Omit<
    De<typeof crearServicioReinicio>,
    'enviarEnlaceReinicio' | 'cerrarSesionesDe'
  >
  administracion: Omit<
    De<typeof crearServicioAdministracion>,
    'cerrarSesionesDe'
  >
  lecturas: De<typeof crearServicioLecturas>
  correo: Omit<De<typeof crearServicioCorreo>, 'urlPublica'>
  ahora?: () => number
}

export function crearAplicacion({
  urlPublica,
  sesion,
  autenticacion,
  reinicio,
  administracion,
  lecturas,
  correo,
  ahora = Date.now,
}: Dependencias) {
  const servicioSesion = crearServicioSesion(sesion)
  const servicioCorreo = crearServicioCorreo({ ...correo, urlPublica })
  const servicioAutenticacion = crearServicioAutenticacion({
    ...autenticacion,
    iniciarSesion: servicioSesion.iniciar,
    ahora,
  })
  const servicioReinicio = crearServicioReinicio({
    ...reinicio,
    enviarEnlaceReinicio: servicioCorreo.enviarEnlaceReinicio,
    cerrarSesionesDe: servicioSesion.cerrarTodasDe,
  })
  const servicioAdministracion = crearServicioAdministracion({
    ...administracion,
    cerrarSesionesDe: servicioSesion.cerrarTodasDe,
  })
  const servicioLecturas = crearServicioLecturas(lecturas)

  const sesionExigida = exigirSesion({
    nombreCookie: seguridad.sesion.nombreCookie,
    validarSesion: servicioSesion.validar,
  })
  const limitador = crearLimitador(seguridad.limitador)

  const app = express()
  app.disable('x-powered-by')
  // nginx le pasa a la API la IP real de la persona en X-Forwarded-For (ver la configuración de nginx).
  // El 1 significa: confiar solo en un salto, el de nginx.
  app.set('trust proxy', 1)

  // No pide sesión ni revisa Origin porque no devuelve datos: solo dice si la API está viva.
  app.get('/api/panel/salud', (_req, res) => {
    res.json({ estado: 'ok' })
  })

  // nginx le pasa a la API la ruta completa, por eso el prefijo es /api/panel.
  const panel = Router()
  // Ninguna respuesta del panel debe guardarse en caché.
  panel.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })
  panel.use(exigirOrigenPropio(urlPublica))
  panel.use(
    '/autenticacion',
    crearRutasAutenticacion({
      controlador: crearControladorAutenticacion({
        autenticacion: servicioAutenticacion,
        reinicio: servicioReinicio,
        sesion: servicioSesion,
      }),
      exigirSesion: sesionExigida,
      limitador,
    }),
  )
  panel.use(
    '/administracion',
    crearRutasAdministracion({
      controlador: crearControladorAdministracion(servicioAdministracion),
      exigirSesion: sesionExigida,
    }),
  )
  panel.use(
    '/lecturas',
    crearRutasLecturas({
      controlador: crearControladorLecturas(servicioLecturas),
      exigirSesion: sesionExigida,
    }),
  )
  app.use('/api/panel', panel)

  app.use(rutaNoEncontrada)
  app.use(manejarErrores)
  return app
}
