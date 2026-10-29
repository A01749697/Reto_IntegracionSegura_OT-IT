// Es el único archivo que habla con la base de datos.
import { Pool } from 'pg'
import type { Entorno } from '../configuracion/entorno'
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

// Un solo INSERT: o entra todo el envío o no entra nada.
// Los valores van como parámetros ($1, $2...), nunca pegados al texto de la consulta.
export async function insertarLecturas(
  pool: Pool,
  lecturas: Lectura[],
): Promise<void> {
  await pool.query(
    `INSERT INTO lecturas (ts, plc, variable, valor)
     SELECT * FROM unnest($1::timestamptz[], $2::text[], $3::text[], $4::double precision[])`,
    [
      lecturas.map((l) => l.ts.toISOString()),
      lecturas.map((l) => l.plc),
      lecturas.map((l) => l.variable),
      lecturas.map((l) => l.valor),
    ],
  )
}
