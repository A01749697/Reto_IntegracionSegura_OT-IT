// Es el único archivo que lee la tabla lecturas (conexión del rol reto_lectura, que solo puede SELECT).
import type { Pool } from 'pg'

export type UltimaLectura = {
  plc: string
  variable: string
  valor: number
  ts: Date
}

export type PuntoHistorial = { ts: Date; valor: number }

export type FiltrosHistorial = {
  plc: string
  variable: string
  desde: Date
  hasta: Date
  limite: number
}

export type Historial = { puntos: PuntoHistorial[]; truncado: boolean }

type FilaUltima = {
  plc: string
  variable: string
  valor: number
  ts: Date
}

// La lectura más reciente de cada variable de cada PLC.
export async function obtenerUltimasLecturas(
  pool: Pool,
): Promise<UltimaLectura[]> {
  const resultado = await pool.query<FilaUltima>(
    `SELECT DISTINCT ON (plc, variable) plc, variable, valor, ts
     FROM lecturas
     ORDER BY plc, variable, ts DESC`,
  )
  return resultado.rows
}

// Las lecturas de una variable entre dos fechas, de la más antigua a la más reciente.
// Si hay más puntos que el límite, se entregan los más recientes y se avisa con "truncado".
export async function obtenerHistorial(
  pool: Pool,
  filtros: FiltrosHistorial,
): Promise<Historial> {
  // Se pide uno más que el límite solo para saber si había más.
  const resultado = await pool.query<PuntoHistorial>(
    `SELECT ts, valor
     FROM lecturas
     WHERE plc = $1 AND variable = $2 AND ts >= $3 AND ts <= $4
     ORDER BY ts DESC
     LIMIT $5`,
    [
      filtros.plc,
      filtros.variable,
      filtros.desde.toISOString(),
      filtros.hasta.toISOString(),
      filtros.limite + 1,
    ],
  )
  const truncado = resultado.rows.length > filtros.limite
  const puntos = resultado.rows.slice(0, filtros.limite).reverse()
  return { puntos, truncado }
}

export type EstadoVariable = {
  plc: string
  variable: string
  ts: Date
  segundosDesdeRecibida: number
}

type FilaEstado = {
  plc: string
  variable: string
  ts: Date
  segundos: string
}

// Por cada variable, su lectura mas reciente y hace cuanto llego a la nube (con el reloj de la base).
export async function obtenerEstadoLecturas(
  pool: Pool,
): Promise<EstadoVariable[]> {
  const resultado = await pool.query<FilaEstado>(
    `SELECT DISTINCT ON (plc, variable)
            plc, variable, ts,
            EXTRACT(EPOCH FROM (now() - recibido_en)) AS segundos
     FROM lecturas
     ORDER BY plc, variable, ts DESC`,
  )
  return resultado.rows.map((fila) => ({
    plc: fila.plc,
    variable: fila.variable,
    ts: fila.ts,
    segundosDesdeRecibida: Math.max(0, Math.round(Number(fila.segundos))),
  }))
}

export type ActividadCubeta = { inicio: Date; lecturas: number }

export type ActividadLecturas = {
  ahora: Date
  primera: Date | null
  cubetas: ActividadCubeta[]
}

type FilaReferencia = { ahora: Date; primera: Date | null }

// Cuántas lecturas llegaron a la nube en cada tramo de tiempo (por la hora de llegada, "recibido_en").
// Cada tramo dura "cubetaSegundos" y se piden los últimos "cantidad", contando el que está en curso.
// Solo regresa los tramos donde llegó algo; quien llama completa los vacíos.
// Con el índice lecturas_recibido_idx (ver esquema.sql) las dos consultas son rápidas.
export async function obtenerActividadLecturas(
  pool: Pool,
  cubetaSegundos: number,
  cantidad: number,
): Promise<ActividadLecturas> {
  const referencia = await pool.query<FilaReferencia>(
    'SELECT now() AS ahora, min(recibido_en) AS primera FROM lecturas',
  )
  const fila = referencia.rows[0]
  if (!fila) throw new Error('La base no devolvió la hora actual')
  const { ahora, primera } = fila

  // La hora de la base se pasa de vuelta para que las dos consultas hablen del mismo instante.
  const resultado = await pool.query<ActividadCubeta>(
    `SELECT to_timestamp(floor(extract(epoch FROM recibido_en) / $1::double precision) * $1::double precision) AS inicio,
            count(*)::int AS lecturas
     FROM lecturas
     WHERE recibido_en >= to_timestamp(
       (floor(extract(epoch FROM $3::timestamptz) / $1::double precision) - $2::double precision + 1) * $1::double precision
     )
       AND recibido_en <= $3::timestamptz
     GROUP BY 1
     ORDER BY 1`,
    [cubetaSegundos, cantidad, ahora.toISOString()],
  )
  return { ahora, primera, cubetas: resultado.rows }
}
