// Punto de arranque: lee la configuración, conecta la base de datos y el correo, y abre el puerto.
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'
import { crearAplicacion } from './aplicacion'
import { leerEntorno } from './configuracion/entorno'
import { crearPool } from './repositorios/conexion'
import * as enlaces from './repositorios/enlaces.repositorio'
import * as lecturas from './repositorios/lecturas.repositorio'
import * as sesiones from './repositorios/sesiones.repositorio'
import * as usuarios from './repositorios/usuarios.repositorio'

function iniciar() {
  const entorno = leerEntorno()
  // Dos conexiones con dos roles distintos: cuentas y sesiones por un lado, lecturas por otro.
  const poolPanel = crearPool(entorno.baseDatosPanel)
  const poolLectura = crearPool(entorno.baseDatosLectura)
  // Sin llaves: el cliente toma las credenciales del rol de IAM de la instancia.
  const clienteCorreo = new SESv2Client({ region: entorno.regionAws })

  const app = crearAplicacion({
    urlPublica: entorno.urlPublica,
    sesion: {
      crearSesion: (usuarioId, tokenHash, duracionMaximaMs) =>
        sesiones.crearSesion(poolPanel, usuarioId, tokenHash, duracionMaximaMs),
      buscarSesionActiva: (tokenHash, inactividadMaximaMs) =>
        sesiones.buscarSesionActiva(poolPanel, tokenHash, inactividadMaximaMs),
      revocarSesion: (tokenHash) =>
        sesiones.revocarSesion(poolPanel, tokenHash),
      revocarSesionesDeUsuario: (usuarioId) =>
        sesiones.revocarSesionesDeUsuario(poolPanel, usuarioId),
    },
    autenticacion: {
      crearUsuario: (datos) => usuarios.crearUsuario(poolPanel, datos),
      buscarPorCorreo: (correo) => usuarios.buscarPorCorreo(poolPanel, correo),
      registrarIntentoFallido: (usuarioId, intentosMaximos, bloqueoMs) =>
        usuarios.registrarIntentoFallido(
          poolPanel,
          usuarioId,
          intentosMaximos,
          bloqueoMs,
        ),
      limpiarIntentos: (usuarioId) =>
        usuarios.limpiarIntentos(poolPanel, usuarioId),
    },
    reinicio: {
      buscarPorCorreo: (correo) => usuarios.buscarPorCorreo(poolPanel, correo),
      invalidarEnlacesPendientes: (usuarioId) =>
        enlaces.invalidarEnlacesPendientes(poolPanel, usuarioId),
      crearEnlace: (usuarioId, tokenHash, duracionMs) =>
        enlaces.crearEnlace(poolPanel, usuarioId, tokenHash, duracionMs),
      consumirEnlace: (tokenHash) =>
        enlaces.consumirEnlace(poolPanel, tokenHash),
      cambiarContrasena: (usuarioId, contrasenaHash) =>
        usuarios.cambiarContrasena(poolPanel, usuarioId, contrasenaHash),
    },
    administracion: {
      listarPorEstado: (estado) => usuarios.listarPorEstado(poolPanel, estado),
      buscarPorId: (id) => usuarios.buscarPorId(poolPanel, id),
      cambiarEstado: (id, estado, decididoPor) =>
        usuarios.cambiarEstado(poolPanel, id, estado, decididoPor),
    },
    lecturas: {
      obtenerUltimasLecturas: () =>
        lecturas.obtenerUltimasLecturas(poolLectura),
      obtenerHistorial: (filtros) =>
        lecturas.obtenerHistorial(poolLectura, filtros),
    },
    correo: {
      remitente: entorno.correoRemitente,
      enviar: async (entrada) => {
        await clienteCorreo.send(new SendEmailCommand(entrada))
      },
    },
  })

  // Dentro del contenedor se escucha en 0.0.0.0 para que Docker pueda publicar el puerto.
  // Hacia afuera del servidor solo se publica en 127.0.0.1 (ver docker-compose.yml).
  const servidor = app.listen(entorno.puerto, '0.0.0.0', () => {
    console.log(`API del panel escuchando en el puerto ${entorno.puerto}`)
  })

  // Al apagar el contenedor, primero se dejan de aceptar peticiones y luego se cierran las conexiones.
  function cerrar() {
    servidor.close(() => {
      clienteCorreo.destroy()
      void Promise.all([poolPanel.end(), poolLectura.end()]).then(() =>
        process.exit(0),
      )
    })
  }
  process.on('SIGTERM', cerrar)
  process.on('SIGINT', cerrar)
}

try {
  iniciar()
} catch (error) {
  console.error(
    'No se pudo iniciar la API:',
    error instanceof Error ? error.message : error,
  )
  process.exit(1)
}
