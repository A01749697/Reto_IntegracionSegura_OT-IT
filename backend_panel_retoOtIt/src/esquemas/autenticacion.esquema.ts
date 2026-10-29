// Reglas de los JSON que manda el navegador en crear cuenta, entrar y recuperar contraseña.
// Todo lo que no cumpla se rechaza.
import { seguridad } from '../configuracion/seguridad'
import { tieneFormatoDeToken } from '../utilidades/tokens'

export type Resultado<T> = { ok: true; datos: T } | { ok: false; error: string }

export type DatosCrearCuenta = {
  nombre: string
  correo: string
  contrasena: string
}
export type DatosEntrar = { correo: string; contrasena: string }
export type DatosPedirReinicio = { correo: string }
export type DatosUsarEnlace = { token: string; contrasena: string }

type Parcial<T> = { valor: T } | { error: string }

const FORMATO_CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const LARGO_MAXIMO_CORREO = 254
const LARGO_MAXIMO_NOMBRE = 100

function esObjeto(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

// Devuelve el cuerpo si tiene exactamente los campos pedidos, o un texto con el error.
function revisarCampos(
  cuerpo: unknown,
  campos: readonly string[],
): Record<string, unknown> | string {
  if (!esObjeto(cuerpo)) return 'El cuerpo debe ser un objeto JSON'
  const claves = Object.keys(cuerpo)
  if (
    claves.length !== campos.length ||
    !claves.every((c) => campos.includes(c))
  ) {
    return `El cuerpo debe tener exactamente los campos ${campos.join(', ')}`
  }
  return cuerpo
}

function tieneCaracteresDeControl(texto: string): boolean {
  for (const caracter of texto) {
    const codigo = caracter.codePointAt(0) ?? 0
    if (codigo < 32 || codigo === 127) return true
  }
  return false
}

// El correo se guarda en minúsculas y sin espacios en los extremos,
// igual que lo exige la regla de la tabla usuarios.
function validarCorreo(x: unknown): Parcial<string> {
  if (typeof x !== 'string') return { error: 'correo debe ser texto' }
  const correo = x.trim().toLowerCase()
  if (correo.length > LARGO_MAXIMO_CORREO || !FORMATO_CORREO.test(correo)) {
    return { error: 'correo no es válido' }
  }
  return { valor: correo }
}

function validarNombre(x: unknown): Parcial<string> {
  if (typeof x !== 'string') return { error: 'nombre debe ser texto' }
  const nombre = x.trim()
  if (
    nombre.length < 1 ||
    nombre.length > LARGO_MAXIMO_NOMBRE ||
    tieneCaracteresDeControl(nombre)
  ) {
    return {
      error: `nombre debe tener de 1 a ${LARGO_MAXIMO_NOMBRE} caracteres`,
    }
  }
  return { valor: nombre }
}

// Contraseña nueva: se exige el largo mínimo. No se recorta (los espacios cuentan).
function validarContrasenaNueva(x: unknown): Parcial<string> {
  const { largoMinimo, largoMaximo } = seguridad.contrasena
  if (
    typeof x !== 'string' ||
    x.length < largoMinimo ||
    x.length > largoMaximo
  ) {
    return {
      error: `contrasena debe tener de ${largoMinimo} a ${largoMaximo} caracteres`,
    }
  }
  return { valor: x }
}

// Al entrar no se revisa el mínimo, solo que exista y no sea gigante.
function validarContrasenaDeEntrada(x: unknown): Parcial<string> {
  const { largoMaximo } = seguridad.contrasena
  if (typeof x !== 'string' || x.length < 1 || x.length > largoMaximo) {
    return { error: 'contrasena no es válida' }
  }
  return { valor: x }
}

function validarToken(x: unknown): Parcial<string> {
  if (typeof x !== 'string' || !tieneFormatoDeToken(x)) {
    return { error: 'enlace no válido' }
  }
  return { valor: x }
}

export function validarCrearCuenta(
  cuerpo: unknown,
): Resultado<DatosCrearCuenta> {
  const campos = revisarCampos(cuerpo, ['nombre', 'correo', 'contrasena'])
  if (typeof campos === 'string') return { ok: false, error: campos }

  const nombre = validarNombre(campos.nombre)
  if ('error' in nombre) return { ok: false, error: nombre.error }
  const correo = validarCorreo(campos.correo)
  if ('error' in correo) return { ok: false, error: correo.error }
  const contrasena = validarContrasenaNueva(campos.contrasena)
  if ('error' in contrasena) return { ok: false, error: contrasena.error }

  return {
    ok: true,
    datos: {
      nombre: nombre.valor,
      correo: correo.valor,
      contrasena: contrasena.valor,
    },
  }
}

export function validarEntrar(cuerpo: unknown): Resultado<DatosEntrar> {
  const campos = revisarCampos(cuerpo, ['correo', 'contrasena'])
  if (typeof campos === 'string') return { ok: false, error: campos }

  const correo = validarCorreo(campos.correo)
  if ('error' in correo) return { ok: false, error: correo.error }
  const contrasena = validarContrasenaDeEntrada(campos.contrasena)
  if ('error' in contrasena) return { ok: false, error: contrasena.error }

  return {
    ok: true,
    datos: { correo: correo.valor, contrasena: contrasena.valor },
  }
}

export function validarPedirReinicio(
  cuerpo: unknown,
): Resultado<DatosPedirReinicio> {
  const campos = revisarCampos(cuerpo, ['correo'])
  if (typeof campos === 'string') return { ok: false, error: campos }

  const correo = validarCorreo(campos.correo)
  if ('error' in correo) return { ok: false, error: correo.error }

  return { ok: true, datos: { correo: correo.valor } }
}

export function validarUsarEnlace(cuerpo: unknown): Resultado<DatosUsarEnlace> {
  const campos = revisarCampos(cuerpo, ['token', 'contrasena'])
  if (typeof campos === 'string') return { ok: false, error: campos }

  const token = validarToken(campos.token)
  if ('error' in token) return { ok: false, error: token.error }
  const contrasena = validarContrasenaNueva(campos.contrasena)
  if ('error' in contrasena) return { ok: false, error: contrasena.error }

  return {
    ok: true,
    datos: { token: token.valor, contrasena: contrasena.valor },
  }
}
