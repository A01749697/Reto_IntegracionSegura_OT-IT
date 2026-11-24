// Es el único archivo que lee el historian (conexión del rol app_lectura, que solo puede SELECT).
// Las tablas son las de docker_retoOtIt/db/historian.sql: una por estación, con ts_pi, ts_plc, nodo y valor.
// Hacia el resto del panel cada fila se entrega como { plc, variable, valor, ts }:
//   plc = la estación (S7-300, S7-1500, S7-1200), variable = el nodo OPC UA,
//   valor = el texto convertido a número (True = 1, False = 0), ts = ts_plc.
// Las consultas usan el índice (nodo, ts_plc DESC) de cada tabla; por eso piden ts_plc no vacío.
import type { Pool } from 'pg'
import {
  PLCS_HISTORIAN,
  TABLAS_POR_PLC,
  type PlcHistorian,
} from '../configuracion/historian'

export type UltimaLectura = {
  plc: string
  variable: string
  valor: number
  ts: Date
}

export type PuntoHistorial = { ts: Date; valor: number }

export type FiltrosHistorial = {
  plc: PlcHistorian
  variable: string
  desde: Date
  hasta: Date
  limite: number
}

export type Historial = { puntos: PuntoHistorial[]; truncado: boolean }

// El historian guarda el valor como texto. Lo que no sea booleano ni número no se puede graficar.
export function valorNumerico(texto: string): number | null {
  const limpio = texto.trim()
  const minusculas = limpio.toLowerCase()
  if (minusculas === 'true') return 1
  if (minusculas === 'false') return 0
  if (limpio === '') return null
  const numero = Number(limpio)
  return Number.isFinite(numero) ? numero : null
}

type FilaUltima = {
  nodo: string
  valor: string
  ts_plc: Date
  segundos: string
}

// La fila más reciente de cada nodo de una tabla.
// Primero recorre los nodos distintos saltando por el índice (sin leer toda la tabla)
// y luego toma la fila más nueva de cada uno.
function consultaUltimas(tabla: string): string {
  return `WITH RECURSIVE nodos AS (
            (SELECT nodo FROM ${tabla} ORDER BY nodo LIMIT 1)
            UNION ALL
            SELECT (SELECT t.nodo FROM ${tabla} t WHERE t.nodo > n.nodo ORDER BY t.nodo LIMIT 1)
            FROM nodos n WHERE n.nodo IS NOT NULL
          )
          SELECT u.nodo, u.valor, u.ts_plc,
                 EXTRACT(EPOCH FROM (now() - u.ts_pi)) AS segundos
          FROM nodos n
          CROSS JOIN LATERAL (
            SELECT t.nodo, t.valor, t.ts_plc, t.ts_pi
            FROM ${tabla} t
            WHERE t.nodo = n.nodo AND t.ts_plc IS NOT NULL
            ORDER BY t.ts_plc DESC
            LIMIT 1
          ) u
          WHERE n.nodo IS NOT NULL`
}

async function ultimasFilas(
  pool: Pool,
): Promise<{ plc: PlcHistorian; fila: FilaUltima }[]> {
  const resultados = await Promise.all(
    PLCS_HISTORIAN.map(async (plc) => {
      const { rows } = await pool.query<FilaUltima>(
        consultaUltimas(TABLAS_POR_PLC[plc]),
      )
      return rows.map((fila) => ({ plc, fila }))
    }),
  )
  return resultados.flat()
}

// La lectura más reciente de cada nodo de cada estación. Los valores que no son número se omiten.
export async function obtenerUltimasLecturas(
  pool: Pool,
): Promise<UltimaLectura[]> {
  const lecturas: UltimaLectura[] = []
  for (const { plc, fila } of await ultimasFilas(pool)) {
    const valor = valorNumerico(fila.valor)
    if (valor === null) continue
    lecturas.push({ plc, variable: fila.nodo, valor, ts: fila.ts_plc })
  }
  return lecturas
}

// Las lecturas de un nodo entre dos fechas, de la más antigua a la más reciente.
// Si hay más puntos que el límite, se entregan los más recientes y se avisa con "truncado".
export async function obtenerHistorial(
  pool: Pool,
  filtros: FiltrosHistorial,
): Promise<Historial> {
  // Se pide uno más que el límite solo para saber si había más.
  const resultado = await pool.query<{ ts: Date; valor: string }>(
    `SELECT ts_plc AS ts, valor
     FROM ${TABLAS_POR_PLC[filtros.plc]}
     WHERE nodo = $1 AND ts_plc >= $2 AND ts_plc <= $3
     ORDER BY ts_plc DESC
     LIMIT $4`,
    [
      filtros.variable,
      filtros.desde.toISOString(),
      filtros.hasta.toISOString(),
      filtros.limite + 1,
    ],
  )
  const truncado = resultado.rows.length > filtros.limite
  const puntos: PuntoHistorial[] = []
  for (const fila of resultado.rows.slice(0, filtros.limite).reverse()) {
    const valor = valorNumerico(fila.valor)
    if (valor !== null) puntos.push({ ts: fila.ts, valor })
  }
  return { puntos, truncado }
}

export type EstadoVariable = {
  plc: string
  variable: string
  ts: Date
  segundosDesdeRecibida: number
}

// Por cada nodo, su lectura más reciente y hace cuánto la guardó el historian (ts_pi, reloj de la base).
export async function obtenerEstadoLecturas(
  pool: Pool,
): Promise<EstadoVariable[]> {
  return (await ultimasFilas(pool)).map(({ plc, fila }) => ({
    plc,
    variable: fila.nodo,
    ts: fila.ts_plc,
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

const TODAS = Object.values(TABLAS_POR_PLC)

// Cuántas lecturas hubo en cada tramo de tiempo (por ts_plc), sumando las tres estaciones.
// Cada tramo dura "cubetaSegundos" y se piden los últimos "cantidad", contando el que está en curso.
// Solo regresa los tramos donde llegó algo; quien llama completa los vacíos.
export async function obtenerActividadLecturas(
  pool: Pool,
  cubetaSegundos: number,
  cantidad: number,
): Promise<ActividadLecturas> {
  const minimos = TODAS.map((t) => `(SELECT min(ts_plc) FROM ${t})`).join(', ')
  const referencia = await pool.query<FilaReferencia>(
    `SELECT now() AS ahora, LEAST(${minimos}) AS primera`,
  )
  const fila = referencia.rows[0]
  if (!fila) throw new Error('La base no devolvió la hora actual')
  const { ahora, primera } = fila

  const union = TODAS.map(
    (t) =>
      `SELECT ts_plc FROM ${t} WHERE ts_plc >= (SELECT desde FROM rango) AND ts_plc <= $3::timestamptz`,
  ).join(' UNION ALL ')

  // La hora de la base se pasa de vuelta para que las dos consultas hablen del mismo instante.
  const resultado = await pool.query<ActividadCubeta>(
    `WITH rango AS (
       SELECT to_timestamp(
         (floor(extract(epoch FROM $3::timestamptz) / $1::double precision) - $2::double precision + 1) * $1::double precision
       ) AS desde
     )
     SELECT to_timestamp(floor(extract(epoch FROM ts_plc) / $1::double precision) * $1::double precision) AS inicio,
            count(*)::int AS lecturas
     FROM (${union}) filas
     GROUP BY 1
     ORDER BY 1`,
    [cubetaSegundos, cantidad, ahora.toISOString()],
  )
  return { ahora, primera, cubetas: resultado.rows }
}
