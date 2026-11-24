// Es el único archivo que habla con la base de datos.
import { Pool } from 'pg'
import type { Entorno } from '../configuracion/entorno'
import { ESTACIONES, TABLAS_POR_ESTACION } from '../configuracion/reglas'
import type { Lectura } from '../esquemas/lecturas.esquema'

export function crearPool(baseDatos: Entorno['baseDatos']): Pool {
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

// Todo el envío va en una transacción: o entra completo o no entra nada.
// Un INSERT por estación; el nombre de la tabla sale de TABLAS_POR_ESTACION, nunca del cuerpo.
// Los valores van como parámetros ($1, $2...), nunca pegados al texto de la consulta.
export async function insertarLecturas(
  pool: Pool,
  lecturas: Lectura[],
): Promise<void> {
  const cliente = await pool.connect()
  try {
    await cliente.query('BEGIN')
    for (const estacion of ESTACIONES) {
      const grupo = lecturas.filter((l) => l.estacion === estacion)
      if (grupo.length === 0) continue
      await cliente.query(
        `INSERT INTO ${TABLAS_POR_ESTACION[estacion]} (ts_plc, nodo, valor)
         SELECT * FROM unnest($1::timestamptz[], $2::text[], $3::text[])`,
        [
          grupo.map((l) => l.tsPlc?.toISOString() ?? null),
          grupo.map((l) => l.nodo),
          grupo.map((l) => l.valor),
        ],
      )
    }
    await cliente.query('COMMIT')
  } catch (error) {
    await cliente.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    cliente.release()
  }
}
