// Es el único archivo que habla con la tabla enlaces_reinicio (conexión del rol reto_panel).
import type { Pool } from 'pg'

// La fecha de caducidad la calcula la base de datos con su propio reloj,
// así no depende de que la hora de la API y la de la base coincidan.
export async function crearEnlace(
  pool: Pool,
  usuarioId: number,
  tokenHash: string,
  duracionMs: number,
): Promise<void> {
  await pool.query(
    `INSERT INTO enlaces_reinicio (usuario_id, token_hash, expira_en)
     VALUES ($1, $2, now() + ($3::double precision * interval '1 millisecond'))`,
    [usuarioId, tokenHash, duracionMs],
  )
}

// Se marcan como usados para que ya no sirvan.
// Se llama antes de crear un enlace nuevo, así solo vale el último que se pidió.
export async function invalidarEnlacesPendientes(
  pool: Pool,
  usuarioId: number,
): Promise<void> {
  await pool.query(
    `UPDATE enlaces_reinicio
     SET usado_en = now()
     WHERE usuario_id = $1 AND usado_en IS NULL`,
    [usuarioId],
  )
}

// Revisa y gasta el enlace en una sola instrucción: solo funciona si existe,
// no se ha usado y no ha caducado. Devuelve el id de la cuenta, o null si no sirve.
export async function consumirEnlace(
  pool: Pool,
  tokenHash: string,
): Promise<number | null> {
  const resultado = await pool.query<{ usuario_id: string }>(
    `UPDATE enlaces_reinicio
     SET usado_en = now()
     WHERE token_hash = $1 AND usado_en IS NULL AND expira_en > now()
     RETURNING usuario_id`,
    [tokenHash],
  )
  const fila = resultado.rows[0]
  return fila ? Number(fila.usuario_id) : null
}
