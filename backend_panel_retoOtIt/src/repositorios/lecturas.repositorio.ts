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
