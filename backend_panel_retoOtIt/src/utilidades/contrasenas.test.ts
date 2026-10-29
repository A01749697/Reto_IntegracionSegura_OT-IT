import { describe, expect, it } from 'vitest'
import {
  crearHuella,
  gastarTiempoDeVerificacion,
  verificarContrasena,
} from './contrasenas'

// Cada huella tarda una fracción de segundo a propósito; se da más margen de tiempo.
describe('contrasenas', { timeout: 20000 }, () => {
  it('crea una huella con el formato esperado y sin la contraseña adentro', async () => {
    const huella = await crearHuella('mi-clave-segura-1')
    expect(huella).toMatch(
      /^scrypt\$32768\$8\$3\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/,
    )
    expect(huella).not.toContain('mi-clave-segura-1')
  })

  it('la misma contraseña da huellas distintas cada vez (por la sal)', async () => {
    const primera = await crearHuella('mi-clave-segura-1')
    const segunda = await crearHuella('mi-clave-segura-1')
    expect(primera).not.toBe(segunda)
  })

  it('acepta la contraseña correcta y rechaza una incorrecta', async () => {
    const huella = await crearHuella('mi-clave-segura-1')
    expect(await verificarContrasena('mi-clave-segura-1', huella)).toBe(true)
    expect(await verificarContrasena('mi-clave-segura-2', huella)).toBe(false)
    expect(await verificarContrasena('', huella)).toBe(false)
  })

  it('funciona con acentos, eñes y emojis', async () => {
    const contrasena = 'contraseña-ñandú-🔒'
    const huella = await crearHuella(contrasena)
    expect(await verificarContrasena(contrasena, huella)).toBe(true)
  })

  it.each([
    '',
    'texto',
    'bcrypt$32768$8$3$AAAA$AAAA',
    'scrypt$32768$8$3$AAAA',
    'scrypt$a$b$c$AAAA$AAAA',
    'scrypt$0$8$3$AAAA$AAAA',
    'scrypt$32768$8$3$AAAA$',
  ])('rechaza una huella mal formada (%j)', async (huella) => {
    expect(await verificarContrasena('cualquiera', huella)).toBe(false)
  })

  it('gastarTiempoDeVerificacion termina sin error', async () => {
    await expect(
      gastarTiempoDeVerificacion('cualquiera'),
    ).resolves.toBeUndefined()
  })
})
