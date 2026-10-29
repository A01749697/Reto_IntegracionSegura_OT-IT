// Es el único archivo que habla con la tabla sesiones (conexión del rol reto_panel).
import type { Pool } from 'pg'
import type { Rol } from './usuarios.repositorio'

export type SesionActiva = {
  sesionId: number
  usuarioId: number
  nombre: string
  correo: string
  rol: Rol
}

type FilaSesionActiva = {
  sesion_id: string
  usuario_id: string
  nombre: string
  correo: string
  rol: string
}

// La caducidad máxima se calcula con el reloj de la base de datos.
export async function crearSesion(
  pool: Pool,
  usuarioId: number,
  tokenHash: string,
  duracionMaximaMs: number,
): Promise<void> {
  await pool.query(
    `INSERT INTO sesiones (usuario_id, token_hash, expira_en)
     VALUES ($1, $2, now() + ($3::double precision * interval '1 millisecond'))`,
    [usuarioId, tokenHash, duracionMaximaMs],
  )
}

// Revisa la sesión y marca que se usó, todo en una sola instrucción.
// Solo sirve si no está revocada, no pasó su tiempo máximo, no pasó el tiempo
// sin uso y la cuenta sigue aprobada. Devuelve null si no sirve por cualquier motivo.
export async function buscarSesionActiva(
  pool: Pool,
  tokenHash: string,
  inactividadMaximaMs: number,
): Promise<SesionActiva | null> {
  const resultado = await pool.query<FilaSesionActiva>(
    `UPDATE sesiones AS s
     SET ultimo_uso_en = now()
     FROM usuarios AS u
     WHERE s.token_hash = $1
       AND u.id = s.usuario_id
       AND s.revocada_en IS NULL
       AND s.expira_en > now()
       AND s.ultimo_uso_en > now() - ($2::double precision * interval '1 millisecond')
       AND u.estado = 'aprobado'
     RETURNING s.id AS sesion_id, u.id AS usuario_id, u.nombre, u.correo, u.rol`,
    [tokenHash, inactividadMaximaMs],
  )
  const fila = resultado.rows[0]
  if (!fila) return null
  return {
    sesionId: Number(fila.sesion_id),
    usuarioId: Number(fila.usuario_id),
    nombre: fila.nombre,
    correo: fila.correo,
    // La regla CHECK de la tabla garantiza que solo haya valores válidos.
    rol: fila.rol as Rol,
  }
}

// Cierra una sesión (botón "salir"). No la borra: queda marcada con su fecha.
export async function revocarSesion(
  pool: Pool,
  tokenHash: string,
): Promise<void> {
  await pool.query(
    `UPDATE sesiones
     SET revocada_en = now()
     WHERE token_hash = $1 AND revocada_en IS NULL`,
    [tokenHash],
  )
}

// Cierra todas las sesiones abiertas de una cuenta (por ejemplo, al cambiar su contraseña).
export async function revocarSesionesDeUsuario(
  pool: Pool,
  usuarioId: number,
): Promise<void> {
  await pool.query(
    `UPDATE sesiones
     SET revocada_en = now()
     WHERE usuario_id = $1 AND revocada_en IS NULL`,
    [usuarioId],
  )
}
