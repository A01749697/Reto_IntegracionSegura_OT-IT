import type { Pool } from 'pg'

export const TIPOS_EVENTO = [
  'entrada_correcta',
  'entrada_fallida',
  'entrada_bloqueada',
  'cuenta_bloqueada',
  'entrada_pendiente',
  'entrada_rechazada',
  'cuenta_solicitada',
  'solicitud_repetida',
  'reinicio_solicitado',
  'reinicio_fallido',
  'contrasena_restablecida',
  'sesion_cerrada',
  'cuenta_aprobada',
  'cuenta_rechazada',
] as const

export type TipoEvento = (typeof TIPOS_EVENTO)[number]

// Los que un administrador querria revisar primero.
export const TIPOS_ALERTA: readonly TipoEvento[] = [
  'entrada_fallida',
  'entrada_bloqueada',
  'cuenta_bloqueada',
  'entrada_pendiente',
  'entrada_rechazada',
  'solicitud_repetida',
  'reinicio_fallido',
]

export type EventoNuevo = {
  tipo: TipoEvento
  usuarioId?: number | null
  actorId?: number | null
  correo?: string | null
  ip?: string | null
}

export type EventoBitacora = {
  id: number
  ocurrioEn: Date
  tipo: TipoEvento
  usuarioId: number | null
  correo: string | null
  ip: string | null
  actorCorreo: string | null
}

export type FiltrosBitacora = {
  tipos: readonly TipoEvento[] | null
  antes: number | null
  limite: number
}

type FilaEvento = {
  id: string
  ocurrio_en: Date
  tipo: string
  usuario_id: string | null
  correo: string | null
  ip: string | null
  actor_correo: string | null
}

export async function insertarEvento(
  pool: Pool,
  evento: EventoNuevo,
): Promise<void> {
  await pool.query(
    `INSERT INTO bitacora (tipo, usuario_id, actor_id, correo, ip)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      evento.tipo,
      evento.usuarioId ?? null,
      evento.actorId ?? null,
      evento.correo?.slice(0, 254) ?? null,
      evento.ip?.slice(0, 45) ?? null,
    ],
  )
}

// Del mas nuevo al mas viejo. "antes" es el id desde el que se sigue leyendo.
export async function listarEventos(
  pool: Pool,
  filtros: FiltrosBitacora,
): Promise<EventoBitacora[]> {
  const resultado = await pool.query<FilaEvento>(
    `SELECT b.id, b.ocurrio_en, b.tipo, b.usuario_id,
            COALESCE(b.correo, u.correo) AS correo,
            b.ip, a.correo AS actor_correo
     FROM bitacora b
     LEFT JOIN usuarios u ON u.id = b.usuario_id
     LEFT JOIN usuarios a ON a.id = b.actor_id
     WHERE ($1::bigint IS NULL OR b.id < $1)
       AND ($2::text[] IS NULL OR b.tipo = ANY($2))
     ORDER BY b.id DESC
     LIMIT $3`,
    [filtros.antes, filtros.tipos, filtros.limite],
  )
  return resultado.rows.map((fila) => ({
    id: Number(fila.id),
    ocurrioEn: fila.ocurrio_en,
    tipo: fila.tipo as TipoEvento,
    usuarioId: fila.usuario_id === null ? null : Number(fila.usuario_id),
    correo: fila.correo,
    ip: fila.ip,
    actorCorreo: fila.actor_correo,
  }))
}
