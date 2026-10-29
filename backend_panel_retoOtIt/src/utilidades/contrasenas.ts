// Crea y compara las "huellas" de las contraseñas con scrypt (viene incluido en Node).
// Nunca se guarda la contraseña: solo su huella, que no se puede revertir.

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

const COSTO = 32768
const BLOQUE = 8
const PARALELISMO = 3
const LARGO_CLAVE = 64
const LARGO_SAL = 16
const MEMORIA_MAXIMA = 64 * 1024 * 1024
const SAL_FALSA = Buffer.alloc(LARGO_SAL)

type Parametros = { costo: number; bloque: number; paralelismo: number }

const PARAMETROS: Parametros = {
  costo: COSTO,
  bloque: BLOQUE,
  paralelismo: PARALELISMO,
}

function derivarClave(
  contrasena: string,
  sal: Buffer,
  largo: number,
  parametros: Parametros,
): Promise<Buffer> {
  return new Promise((resolver, rechazar) => {
    scrypt(
      contrasena,
      sal,
      largo,
      {
        N: parametros.costo,
        r: parametros.bloque,
        p: parametros.paralelismo,
        maxmem: MEMORIA_MAXIMA,
      },
      (error, clave) => {
        if (error) {
          rechazar(error)
        } else {
          resolver(clave)
        }
      },
    )
  })
}

// Formato guardado: scrypt$costo$bloque$paralelismo$sal$clave (sal y clave en base64)
export async function crearHuella(contrasena: string): Promise<string> {
  const sal = randomBytes(LARGO_SAL)
  const clave = await derivarClave(contrasena, sal, LARGO_CLAVE, PARAMETROS)
  return [
    'scrypt',
    PARAMETROS.costo,
    PARAMETROS.bloque,
    PARAMETROS.paralelismo,
    sal.toString('base64'),
    clave.toString('base64'),
  ].join('$')
}

export async function verificarContrasena(
  contrasena: string,
  huella: string,
): Promise<boolean> {
  const partes = huella.split('$')
  if (partes.length !== 6 || partes[0] !== 'scrypt') {
    return false
  }
  const [, costo, bloque, paralelismo, salTexto, claveTexto] = partes
  const parametros: Parametros = {
    costo: Number(costo),
    bloque: Number(bloque),
    paralelismo: Number(paralelismo),
  }
  if (
    !Object.values(parametros).every((n) => Number.isInteger(n) && n > 0) ||
    salTexto === undefined ||
    claveTexto === undefined
  ) {
    return false
  }

  const sal = Buffer.from(salTexto, 'base64')
  const claveEsperada = Buffer.from(claveTexto, 'base64')
  if (claveEsperada.length === 0) {
    return false
  }

  const claveObtenida = await derivarClave(
    contrasena,
    sal,
    claveEsperada.length,
    parametros,
  )
  return timingSafeEqual(claveObtenida, claveEsperada)
}

// Se usa cuando el correo no existe: gasta el mismo tiempo que una verificación real,
// para que no se pueda adivinar qué correos están registrados midiendo la respuesta.
export async function gastarTiempoDeVerificacion(
  contrasena: string,
): Promise<void> {
  await derivarClave(contrasena, SAL_FALSA, LARGO_CLAVE, PARAMETROS)
}
