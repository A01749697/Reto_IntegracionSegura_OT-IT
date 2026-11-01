const BASE = '/api/panel' // misma direccion del sitio, asi viaja la cookie

export type Usuario = {
  id: number
  nombre: string
  correo: string
  rol: 'usuario' | 'administrador'
}

export type MotivoEntrar =
  | 'credenciales'
  | 'pendiente'
  | 'rechazada'
  | 'bloqueada'
  | 'limite'
  | 'invalido'
  | 'fallo'

export type ResultadoEntrar =
  { ok: true; usuario: Usuario } | { ok: false; motivo: MotivoEntrar }

export type ResultadoSimple =
  | { ok: true }
  | { ok: false; motivo: 'invalido' | 'limite' | 'fallo'; mensaje?: string }

type Respuesta = { estado: number; datos: unknown }

export async function llamar(
  metodo: 'GET' | 'POST',
  ruta: string,
  cuerpo?: object,
): Promise<Respuesta> {
  const respuesta = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: cuerpo ? { 'Content-Type': 'application/json' } : undefined,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  })
  // el 204 no trae cuerpo
  const datos: unknown = await respuesta.json().catch(() => null)
  return { estado: respuesta.status, datos }
}

export function leerCampo(datos: unknown, campo: string): unknown {
  if (typeof datos !== 'object' || datos === null) return undefined
  return (datos as Record<string, unknown>)[campo]
}

function esUsuario(valor: unknown): valor is Usuario {
  if (typeof valor !== 'object' || valor === null) return false
  const u = valor as Record<string, unknown>
  return (
    typeof u.id === 'number' &&
    typeof u.nombre === 'string' &&
    typeof u.correo === 'string' &&
    (u.rol === 'usuario' || u.rol === 'administrador')
  )
}

function motivoDeCodigo(codigo: unknown): MotivoEntrar | null {
  switch (codigo) {
    case 'credenciales_invalidas':
      return 'credenciales'
    case 'pendiente':
      return 'pendiente'
    case 'rechazada':
      return 'rechazada'
    case 'bloqueada':
      return 'bloqueada'
    default:
      return null
  }
}

function aResultadoSimple(
  { estado, datos }: Respuesta,
  esperado: number,
): ResultadoSimple {
  if (estado === esperado) return { ok: true }
  if (estado === 400) {
    const mensaje = leerCampo(datos, 'error')
    return {
      ok: false,
      motivo: 'invalido',
      mensaje: typeof mensaje === 'string' ? mensaje : undefined,
    }
  }
  if (estado === 429) return { ok: false, motivo: 'limite' }
  return { ok: false, motivo: 'fallo' }
}

export async function entrar(
  correo: string,
  contrasena: string,
): Promise<ResultadoEntrar> {
  try {
    const { estado, datos } = await llamar('POST', '/autenticacion/entrar', {
      correo,
      contrasena,
    })
    if (estado === 200) {
      const usuario = leerCampo(datos, 'usuario')
      return esUsuario(usuario)
        ? { ok: true, usuario }
        : { ok: false, motivo: 'fallo' }
    }
    if (estado === 400) return { ok: false, motivo: 'invalido' }
    const motivo = motivoDeCodigo(leerCampo(datos, 'codigo'))
    if (motivo) return { ok: false, motivo }
    // 429 sin codigo = limite por IP, no la cuenta bloqueada
    if (estado === 429) return { ok: false, motivo: 'limite' }
    return { ok: false, motivo: 'fallo' }
  } catch {
    return { ok: false, motivo: 'fallo' }
  }
}

export async function crearCuenta(datos: {
  nombre: string
  correo: string
  clave: string
}): Promise<ResultadoSimple> {
  try {
    const respuesta = await llamar('POST', '/autenticacion/cuenta', {
      nombre: datos.nombre,
      correo: datos.correo,
      contrasena: datos.clave,
    })
    return aResultadoSimple(respuesta, 202)
  } catch {
    return { ok: false, motivo: 'fallo' }
  }
}

export async function pedirReinicio(correo: string): Promise<ResultadoSimple> {
  try {
    const respuesta = await llamar('POST', '/autenticacion/olvide', { correo })
    return aResultadoSimple(respuesta, 202)
  } catch {
    return { ok: false, motivo: 'fallo' }
  }
}

export async function restablecer(
  token: string,
  clave: string,
): Promise<ResultadoSimple> {
  try {
    const respuesta = await llamar('POST', '/autenticacion/restablecer', {
      token,
      contrasena: clave,
    })
    return aResultadoSimple(respuesta, 200)
  } catch {
    return { ok: false, motivo: 'fallo' }
  }
}

export async function cerrarSesion(): Promise<boolean> {
  try {
    const { estado } = await llamar('POST', '/autenticacion/salir')
    return estado === 204
  } catch {
    return false
  }
}

export async function obtenerSesion(): Promise<Usuario | null> {
  try {
    const { estado, datos } = await llamar('GET', '/autenticacion/yo')
    if (estado !== 200) return null
    const usuario = leerCampo(datos, 'usuario')
    return esUsuario(usuario) ? usuario : null
  } catch {
    return null
  }
}
