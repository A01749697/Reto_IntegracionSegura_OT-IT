import { describe, expect, it } from 'vitest'
import {
  validarCrearCuenta,
  validarEntrar,
  validarPedirReinicio,
  validarUsarEnlace,
} from './autenticacion.esquema'

const CONTRASENA_VALIDA = 'una-clave-larga-1'
const TOKEN_VALIDO = 'a1b2c3d4'.repeat(8)

describe('validarCrearCuenta', () => {
  const cuerpoValido = {
    nombre: 'Ana Pérez',
    correo: 'ana@ejemplo.com',
    contrasena: CONTRASENA_VALIDA,
  }

  it('acepta datos válidos', () => {
    expect(validarCrearCuenta(cuerpoValido)).toEqual({
      ok: true,
      datos: cuerpoValido,
    })
  })

  it('limpia el nombre y pasa el correo a minúsculas', () => {
    const resultado = validarCrearCuenta({
      ...cuerpoValido,
      nombre: '  Ana Pérez  ',
      correo: '  ANA@Ejemplo.COM ',
    })
    expect(resultado).toEqual({ ok: true, datos: cuerpoValido })
  })

  it('no recorta los espacios de la contraseña', () => {
    const contrasena = '  ' + 'a'.repeat(10) + '  '
    const resultado = validarCrearCuenta({ ...cuerpoValido, contrasena })
    expect(resultado).toMatchObject({ ok: true, datos: { contrasena } })
  })

  it.each([null, [], 'texto', 42])(
    'rechaza un cuerpo que no es objeto (%j)',
    (cuerpo) => {
      expect(validarCrearCuenta(cuerpo).ok).toBe(false)
    },
  )

  it('rechaza un campo de más, como rol', () => {
    expect(
      validarCrearCuenta({ ...cuerpoValido, rol: 'administrador' }).ok,
    ).toBe(false)
  })

  it('rechaza si falta un campo', () => {
    expect(
      validarCrearCuenta({ nombre: 'Ana', correo: 'ana@ejemplo.com' }).ok,
    ).toBe(false)
  })

  it.each(['sin-arroba', 'a@b', 'a b@c.com', '', 123])(
    'rechaza el correo %j',
    (correo) => {
      expect(validarCrearCuenta({ ...cuerpoValido, correo }).ok).toBe(false)
    },
  )

  it('rechaza un correo de más de 254 caracteres', () => {
    const correo = 'a'.repeat(250) + '@x.com'
    expect(validarCrearCuenta({ ...cuerpoValido, correo }).ok).toBe(false)
  })

  it.each(['', '   ', 'a'.repeat(101), 'Ana\nPérez', 123])(
    'rechaza el nombre %j',
    (nombre) => {
      expect(validarCrearCuenta({ ...cuerpoValido, nombre }).ok).toBe(false)
    },
  )

  it('acepta contraseñas de 12 y de 128 caracteres', () => {
    expect(
      validarCrearCuenta({ ...cuerpoValido, contrasena: 'a'.repeat(12) }).ok,
    ).toBe(true)
    expect(
      validarCrearCuenta({ ...cuerpoValido, contrasena: 'a'.repeat(128) }).ok,
    ).toBe(true)
  })

  it('rechaza contraseñas de 11 y de 129 caracteres', () => {
    expect(
      validarCrearCuenta({ ...cuerpoValido, contrasena: 'a'.repeat(11) }).ok,
    ).toBe(false)
    expect(
      validarCrearCuenta({ ...cuerpoValido, contrasena: 'a'.repeat(129) }).ok,
    ).toBe(false)
  })

  it('el mensaje de error nombra el campo con el problema', () => {
    expect(
      validarCrearCuenta({ ...cuerpoValido, correo: 'mal' }),
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining('correo'),
    })
  })
})

describe('validarEntrar', () => {
  it('acepta correo y contraseña', () => {
    expect(
      validarEntrar({
        correo: 'ANA@ejemplo.com',
        contrasena: CONTRASENA_VALIDA,
      }),
    ).toEqual({
      ok: true,
      datos: { correo: 'ana@ejemplo.com', contrasena: CONTRASENA_VALIDA },
    })
  })

  it('acepta una contraseña corta, porque al entrar no se revisa el mínimo', () => {
    expect(
      validarEntrar({ correo: 'ana@ejemplo.com', contrasena: 'corta' }).ok,
    ).toBe(true)
  })

  it('rechaza una contraseña vacía o de más de 128 caracteres', () => {
    expect(
      validarEntrar({ correo: 'ana@ejemplo.com', contrasena: '' }).ok,
    ).toBe(false)
    expect(
      validarEntrar({ correo: 'ana@ejemplo.com', contrasena: 'a'.repeat(129) })
        .ok,
    ).toBe(false)
  })

  it('rechaza valores que no son texto', () => {
    expect(
      validarEntrar({ correo: 'ana@ejemplo.com', contrasena: 12345678 }).ok,
    ).toBe(false)
    expect(validarEntrar({ correo: { $ne: '' }, contrasena: 'x' }).ok).toBe(
      false,
    )
  })

  it('rechaza un campo de más', () => {
    expect(
      validarEntrar({
        correo: 'ana@ejemplo.com',
        contrasena: 'x',
        recordarme: true,
      }).ok,
    ).toBe(false)
  })
})

describe('validarPedirReinicio', () => {
  it('acepta solo el correo y lo limpia', () => {
    expect(validarPedirReinicio({ correo: ' Ana@Ejemplo.com ' })).toEqual({
      ok: true,
      datos: { correo: 'ana@ejemplo.com' },
    })
  })

  it('rechaza un correo inválido o un campo de más', () => {
    expect(validarPedirReinicio({ correo: 'mal' }).ok).toBe(false)
    expect(
      validarPedirReinicio({ correo: 'ana@ejemplo.com', extra: 1 }).ok,
    ).toBe(false)
  })
})

describe('validarUsarEnlace', () => {
  it('acepta un código de 64 caracteres y una contraseña válida', () => {
    expect(
      validarUsarEnlace({ token: TOKEN_VALIDO, contrasena: CONTRASENA_VALIDA }),
    ).toEqual({
      ok: true,
      datos: { token: TOKEN_VALIDO, contrasena: CONTRASENA_VALIDA },
    })
  })

  it.each(['corto', TOKEN_VALIDO.toUpperCase(), TOKEN_VALIDO + 'a', 123])(
    'rechaza el código %j',
    (token) => {
      expect(
        validarUsarEnlace({ token, contrasena: CONTRASENA_VALIDA }).ok,
      ).toBe(false)
    },
  )

  it('rechaza una contraseña nueva demasiado corta', () => {
    expect(
      validarUsarEnlace({ token: TOKEN_VALIDO, contrasena: 'corta' }).ok,
    ).toBe(false)
  })
})
