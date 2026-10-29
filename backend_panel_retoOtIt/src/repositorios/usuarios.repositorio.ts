// Es el único archivo que habla con la tabla usuarios (conexión del rol reto_panel).
import type { Pool } from 'pg'

export type Rol = 'usuario' | 'administrador'
export type Estado = 'pendiente' | 'aprobado' | 'rechazado'

export type Usuario = {
  id: number
  nombre: string
  correo: string
  contrasenaHash: string
  rol: Rol
  estado: Estado
  intentosFallidos: number
  bloqueadoHasta: Date | null
}

// Para las listas: nunca incluye la huella de la contraseña.
export type UsuarioResumen = {
  id: number
  nombre: string
  correo: string
  rol: Rol
  estado: Estado
  creadoEn: Date
}

export type ResultadoCrear =
  { creado: true; id: number } | { creado: false; motivo: 'correo_repetido' }

// pg entrega los bigint como texto; los ids son pequeños, así que se pasan a número.
type FilaUsuario = {
  id: string
  nombre: string
  correo: string
  contrasena_hash: string
  rol: string
  estado: string
  intentos_fallidos: number
  bloqueado_hasta: Date | null
}

type FilaResumen = {
  id: string
  nombre: string
  correo: string
  rol: string
  estado: string
  creado_en: Date
}

const COLUMNAS_USUARIO =
  'id, nombre, correo, contrasena_hash, rol, estado, intentos_fallidos, bloqueado_hasta'

// Las reglas CHECK de la tabla garantizan que rol y estado solo tengan valores válidos.
function aUsuario(fila: FilaUsuario): Usuario {
  return {
    id: Number(fila.id),
    nombre: fila.nombre,
    correo: fila.correo,
    contrasenaHash: fila.contrasena_hash,
    rol: fila.rol as Rol,
    estado: fila.estado as Estado,
    intentosFallidos: fila.intentos_fallidos,
    bloqueadoHasta: fila.bloqueado_hasta,
  }
}

function esCorreoRepetido(error: unknown): boolean {
  // 23505 es el código de PostgreSQL para "ya existe un valor igual en un índice único".
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  )
}

// Toda cuenta nueva entra como pendiente con rol usuario (así lo dicen los valores por defecto de la tabla).
export async function crearUsuario(
  pool: Pool,
  datos: { nombre: string; correo: string; contrasenaHash: string },
): Promise<ResultadoCrear> {
  try {
    const resultado = await pool.query<{ id: string }>(
      `INSERT INTO usuarios (nombre, correo, contrasena_hash)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [datos.nombre, datos.correo, datos.contrasenaHash],
    )
    const fila = resultado.rows[0]
    if (!fila) throw new Error('El INSERT no devolvió el id')
    return { creado: true, id: Number(fila.id) }
  } catch (error) {
    if (esCorreoRepetido(error)) {
      return { creado: false, motivo: 'correo_repetido' }
    }
    throw error
  }
}

export async function buscarPorCorreo(
  pool: Pool,
  correo: string,
): Promise<Usuario | null> {
  const resultado = await pool.query<FilaUsuario>(
    `SELECT ${COLUMNAS_USUARIO} FROM usuarios WHERE correo = $1`,
    [correo],
  )
  const fila = resultado.rows[0]
  return fila ? aUsuario(fila) : null
}

export async function buscarPorId(
  pool: Pool,
  id: number,
): Promise<Usuario | null> {
  const resultado = await pool.query<FilaUsuario>(
    `SELECT ${COLUMNAS_USUARIO} FROM usuarios WHERE id = $1`,
    [id],
  )
  const fila = resultado.rows[0]
  return fila ? aUsuario(fila) : null
}

export async function listarPorEstado(
  pool: Pool,
  estado: Estado,
): Promise<UsuarioResumen[]> {
  const resultado = await pool.query<FilaResumen>(
    `SELECT id, nombre, correo, rol, estado, creado_en
     FROM usuarios
     WHERE estado = $1
     ORDER BY creado_en`,
    [estado],
  )
  return resultado.rows.map((fila) => ({
    id: Number(fila.id),
    nombre: fila.nombre,
    correo: fila.correo,
    rol: fila.rol as Rol,
    estado: fila.estado as Estado,
    creadoEn: fila.creado_en,
  }))
}

// Guarda quién decidió y cuándo, tanto al aprobar como al rechazar.
// Devuelve false si la cuenta no existe.
export async function cambiarEstado(
  pool: Pool,
  id: number,
  estado: 'aprobado' | 'rechazado',
  decididoPor: number,
): Promise<boolean> {
  const resultado = await pool.query(
    `UPDATE usuarios
     SET estado = $2, aprobado_en = now(), aprobado_por = $3
     WHERE id = $1`,
    [id, estado, decididoPor],
  )
  return resultado.rowCount === 1
}

// Suma un intento fallido. Al llegar al máximo, bloquea la cuenta y vuelve el contador a cero.
// Es una sola instrucción, así dos intentos al mismo tiempo no se saltan la cuenta.
export async function registrarIntentoFallido(
  pool: Pool,
  id: number,
  intentosMaximos: number,
  bloqueoMs: number,
): Promise<void> {
  await pool.query(
    `UPDATE usuarios
     SET intentos_fallidos = CASE
           WHEN intentos_fallidos + 1 >= $2::int THEN 0
           ELSE intentos_fallidos + 1
         END,
         bloqueado_hasta = CASE
           WHEN intentos_fallidos + 1 >= $2::int
             THEN now() + ($3::double precision * interval '1 millisecond')
           ELSE bloqueado_hasta
         END
     WHERE id = $1`,
    [id, intentosMaximos, bloqueoMs],
  )
}

export async function limpiarIntentos(pool: Pool, id: number): Promise<void> {
  await pool.query(
    `UPDATE usuarios
     SET intentos_fallidos = 0, bloqueado_hasta = NULL
     WHERE id = $1`,
    [id],
  )
}

// También quita cualquier bloqueo, porque quien recupera su contraseña ya demostró tener el correo.
export async function cambiarContrasena(
  pool: Pool,
  id: number,
  contrasenaHash: string,
): Promise<void> {
  await pool.query(
    `UPDATE usuarios
     SET contrasena_hash = $2, intentos_fallidos = 0, bloqueado_hasta = NULL
     WHERE id = $1`,
    [id, contrasenaHash],
  )
}
