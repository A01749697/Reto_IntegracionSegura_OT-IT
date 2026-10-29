// Genera los códigos aleatorios de las sesiones y de los enlaces de reinicio.
// El código completo solo viaja al navegador o en el correo.
// En la base de datos se guarda únicamente su huella.

import { createHash, randomBytes } from 'node:crypto'

const FORMATO_TOKEN = /^[0-9a-f]{64}$/

export function generarToken(): string {
  return randomBytes(32).toString('hex')
}

export function calcularHuellaToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function tieneFormatoDeToken(texto: string): boolean {
  return FORMATO_TOKEN.test(texto)
}
