// Punto de arranque: lee la configuración, conecta la base de datos y abre el puerto.
import { crearAplicacion } from './aplicacion'
import { leerEntorno } from './configuracion/entorno'
import {
  crearPool,
  insertarLecturas,
} from './repositorios/lecturas.repositorio'

function iniciar() {
  const entorno = leerEntorno()
  const pool = crearPool(entorno.baseDatos)
  const app = crearAplicacion({
    token: entorno.tokenIngesta,
    guardarLecturas: (lecturas) => insertarLecturas(pool, lecturas),
  })

  // Dentro del contenedor se escucha en 0.0.0.0 para que Docker pueda publicar el puerto.
  // Hacia afuera del servidor solo se publica en 127.0.0.1 (ver docker-compose.yml).
  const servidor = app.listen(entorno.puerto, '0.0.0.0', () => {
    console.log(`API receptora escuchando en el puerto ${entorno.puerto}`)
  })

  // Al apagar el contenedor, primero se dejan de aceptar peticiones y luego se cierra la base.
  function cerrar() {
    servidor.close(() => {
      void pool.end().then(() => process.exit(0))
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
