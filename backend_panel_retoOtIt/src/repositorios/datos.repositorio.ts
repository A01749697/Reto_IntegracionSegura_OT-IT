// Lectura cruda de tablas para la pantalla "Datos". Solo SELECT y solo de la lista de abajo.
// Cada tabla tiene su propia consulta escrita a mano: nunca se arma SQL con texto de la petición.
import type { Pool } from 'pg'

export const TABLAS_DATOS = ['cuentas', 'bitacora'] as const

export type TablaDatos = (typeof TABLAS_DATOS)[number]

export type Celda = string | number | boolean | Date | null
export type FilaDatos = Record<string, Celda>

export type Columna = { clave: string; titulo: string }

export type FiltrosDatos = {
  buscar: string | null
  antes: number | null
  limite: number
}

// Lo que cada tabla deja ver. La contraseña de las cuentas no está y no puede estar.
export const CATALOGO: Record<
  TablaDatos,
  { nombre: string; columnas: readonly Columna[] }
> = {
  cuentas: {
    nombre: 'Cuentas',
    columnas: [
      { clave: 'id', titulo: 'id' },
      { clave: 'nombre', titulo: 'nombre' },
      { clave: 'correo', titulo: 'correo' },
      { clave: 'rol', titulo: 'rol' },
      { clave: 'estado', titulo: 'estado' },
      { clave: 'intentosFallidos', titulo: 'intentos fallidos' },
      { clave: 'bloqueadoHasta', titulo: 'bloqueada hasta' },
      { clave: 'creadoEn', titulo: 'creada' },
      { clave: 'aprobadoEn', titulo: 'aprobada' },
      { clave: 'aprobadoPor', titulo: 'aprobada por (id)' },
    ],
  },
  bitacora: {
    nombre: 'Bitácora',
    columnas: [
      { clave: 'id', titulo: 'id' },
      { clave: 'ocurrioEn', titulo: 'fecha' },
      { clave: 'tipo', titulo: 'tipo' },
      { clave: 'usuarioId', titulo: 'cuenta (id)' },
      { clave: 'actorId', titulo: 'actor (id)' },
      { clave: 'correo', titulo: 'correo' },
      { clave: 'ip', titulo: 'ip' },
    ],
  },
}

// pg entrega los bigint como texto.
function aNumero(valor: string | null): number | null {
  return valor === null ? null : Number(valor)
}

// Para ILIKE: % _ y \ del texto escrito se buscan tal cual, no como comodines.
export function crearPatron(buscar: string | null): string | null {
  if (buscar === null) return null
  return `%${buscar.replace(/[\\%_]/g, '\\$&')}%`
}

type FilaCuenta = {
  id: string
  nombre: string
  correo: string
  rol: string
  estado: string
  intentos_fallidos: number
  bloqueado_hasta: Date | null
  creado_en: Date
  aprobado_en: Date | null
  aprobado_por: string | null
}

async function leerCuentas(
  pool: Pool,
  filtros: FiltrosDatos,
): Promise<FilaDatos[]> {
  const resultado = await pool.query<FilaCuenta>(
    `SELECT id, nombre, correo, rol, estado, intentos_fallidos,
            bloqueado_hasta, creado_en, aprobado_en, aprobado_por
     FROM usuarios
     WHERE ($1::bigint IS NULL OR id < $1)
       AND ($2::text IS NULL OR nombre ILIKE $2 OR correo ILIKE $2)
     ORDER BY id DESC
     LIMIT $3`,
    [filtros.antes, crearPatron(filtros.buscar), filtros.limite],
  )
  return resultado.rows.map((fila) => ({
    id: Number(fila.id),
    nombre: fila.nombre,
    correo: fila.correo,
    rol: fila.rol,
    estado: fila.estado,
    intentosFallidos: fila.intentos_fallidos,
    bloqueadoHasta: fila.bloqueado_hasta,
    creadoEn: fila.creado_en,
    aprobadoEn: fila.aprobado_en,
    aprobadoPor: aNumero(fila.aprobado_por),
  }))
}

type FilaBitacora = {
  id: string
  ocurrio_en: Date
  tipo: string
  usuario_id: string | null
  actor_id: string | null
  correo: string | null
  ip: string | null
}

async function leerBitacora(
  pool: Pool,
  filtros: FiltrosDatos,
): Promise<FilaDatos[]> {
  const resultado = await pool.query<FilaBitacora>(
    `SELECT id, ocurrio_en, tipo, usuario_id, actor_id, correo, ip
     FROM bitacora
     WHERE ($1::bigint IS NULL OR id < $1)
       AND ($2::text IS NULL OR tipo ILIKE $2 OR correo ILIKE $2 OR ip ILIKE $2)
     ORDER BY id DESC
     LIMIT $3`,
    [filtros.antes, crearPatron(filtros.buscar), filtros.limite],
  )
  return resultado.rows.map((fila) => ({
    id: Number(fila.id),
    ocurrioEn: fila.ocurrio_en,
    tipo: fila.tipo,
    usuarioId: aNumero(fila.usuario_id),
    actorId: aNumero(fila.actor_id),
    correo: fila.correo,
    ip: fila.ip,
  }))
}

// Del más nuevo al más viejo. "antes" es el id desde el que se sigue leyendo.
export async function leerTabla(
  pool: Pool,
  tabla: TablaDatos,
  filtros: FiltrosDatos,
): Promise<FilaDatos[]> {
  return tabla === 'cuentas'
    ? leerCuentas(pool, filtros)
    : leerBitacora(pool, filtros)
}
