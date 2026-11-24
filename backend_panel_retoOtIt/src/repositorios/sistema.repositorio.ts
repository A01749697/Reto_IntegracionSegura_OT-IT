// Tamaños de la base historian (las tres tablas de telemetría juntas). Pregunta solo por tamaños, no lee filas de ninguna tabla.
import type { Pool } from 'pg'

export type TamanosBase = {
  totalBytes: number
  lecturasBytes: number
}

type FilaTamanos = { total: string; lecturas: string }

// pg devuelve los enteros grandes como texto, por eso se piden como texto y se convierten aquí.
export async function obtenerTamanosBase(pool: Pool): Promise<TamanosBase> {
  const resultado = await pool.query<FilaTamanos>(
    `SELECT pg_database_size(current_database())::text AS total,
            (pg_total_relation_size('public.telemetria_300')
             + pg_total_relation_size('public.telemetria_1500')
             + pg_total_relation_size('public.telemetria_1200'))::text AS lecturas`,
  )
  const fila = resultado.rows[0]
  if (!fila) throw new Error('La base no devolvió los tamaños')
  const totalBytes = Number(fila.total)
  const lecturasBytes = Number(fila.lecturas)
  if (!Number.isFinite(totalBytes) || !Number.isFinite(lecturasBytes)) {
    throw new Error('La base devolvió tamaños que no son números')
  }
  return { totalBytes, lecturasBytes }
}
