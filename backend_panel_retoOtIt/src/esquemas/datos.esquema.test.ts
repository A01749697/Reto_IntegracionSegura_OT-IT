import { describe, expect, it } from 'vitest'
import { seguridad } from '../configuracion/seguridad'
import { validarConsultaDatos, validarTabla } from './datos.esquema'

describe('validarTabla', () => {
  it.each(['cuentas', 'bitacora'])('acepta %s', (nombre) => {
    expect(validarTabla(nombre)).toEqual({ ok: true, datos: nombre })
  })

  it.each([
    'usuarios',
    'sesiones',
    'enlaces_reinicio',
    'lecturas',
    'Cuentas',
    'cuentas; DROP TABLE usuarios',
    '',
    undefined,
    ['cuentas'],
    { toString: () => 'cuentas' },
  ])('rechaza %j', (valor) => {
    expect(validarTabla(valor)).toEqual({
      ok: false,
      error: 'La tabla no existe',
    })
  })
})

describe('validarConsultaDatos', () => {
  it('sin nada usa los valores por defecto', () => {
    expect(validarConsultaDatos({})).toEqual({
      ok: true,
      datos: { buscar: null, antes: null, limite: seguridad.datos.porDefecto },
    })
  })

  it('acepta buscar, antes y limite', () => {
    expect(
      validarConsultaDatos({ buscar: '  ana ', antes: '40', limite: '10' }),
    ).toEqual({ ok: true, datos: { buscar: 'ana', antes: 40, limite: 10 } })
  })

  it('un texto de búsqueda vacío es lo mismo que no buscar', () => {
    expect(validarConsultaDatos({ buscar: '   ' })).toMatchObject({
      ok: true,
      datos: { buscar: null },
    })
  })

  it('rechaza campos que no existen', () => {
    expect(validarConsultaDatos({ orden: 'asc' }).ok).toBe(false)
    expect(validarConsultaDatos({ columnas: 'contrasena_hash' }).ok).toBe(false)
  })

  it.each([
    ['buscar', ['a', 'b']],
    ['buscar', { a: '1' }],
    ['buscar', 'x'.repeat(seguridad.datos.largoMaximoBusqueda + 1)],
    ['buscar', 'ana\nluis'],
    ['buscar', 'ana\u0000'],
    ['antes', '0'],
    ['antes', '-4'],
    ['antes', '1.5'],
    ['antes', 'abc'],
    ['antes', '1'.repeat(16)],
    ['limite', '0'],
    ['limite', `${seguridad.datos.maximo + 1}`],
    ['limite', 'diez'],
  ])('rechaza %s = %j', (campo, valor) => {
    expect(validarConsultaDatos({ [campo]: valor }).ok).toBe(false)
  })

  it('acepta el límite máximo justo', () => {
    expect(
      validarConsultaDatos({ limite: `${seguridad.datos.maximo}` }).ok,
    ).toBe(true)
  })

  it('rechaza una consulta que no es un objeto', () => {
    expect(validarConsultaDatos(undefined).ok).toBe(false)
    expect(validarConsultaDatos('x').ok).toBe(false)
    expect(validarConsultaDatos([]).ok).toBe(false)
  })
})
