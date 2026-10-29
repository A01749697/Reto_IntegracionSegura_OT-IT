// Crea las conexiones a PostgreSQL. No hace consultas.
import { Pool } from 'pg'
import type { ConexionBaseDatos } from '../configuracion/entorno'

export function crearPool(baseDatos: ConexionBaseDatos): Pool {
  const pool = new Pool({
    host: baseDatos.host,
    port: baseDatos.puerto,
    user: baseDatos.usuario,
    password: baseDatos.contrasena,
    database: baseDatos.nombre,
    max: 5,
    connectionTimeoutMillis: 5000,
  })
  // Sin este aviso, un error en una conexión inactiva tumbaría toda la API.
  pool.on('error', (error) => {
    console.error(
      'Error en una conexión inactiva de la base de datos:',
      error.message,
    )
  })
  return pool
}
