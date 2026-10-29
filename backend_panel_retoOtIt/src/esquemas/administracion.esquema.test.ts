import { describe, expect, it } from 'vitest'
import {
  validarDecision,
  validarEstadoLista,
  validarIdUsuario,
} from './administracion.esquema'

describe('validarEstadoLista', () => {
  it('sin filtro devuelve pendiente', () => {
    expect(validarEstadoLista({})).toEqual({ ok: true, datos: 'pendiente' })
  })

  it.each(['pendiente', 'aprobado', 'rechazado'])('acepta %s', (estado) => {
    expect(validarEstadoLista({ estado })).toEqual({ ok: true, datos: estado })
  })

  it.each([
    { estado: 'otro' },
    { estado: 'PENDIENTE' },
    { estado: ['pendiente'] },
    { estado: 1 },
    { otro: 'pendiente' },
    { estado: 'pendiente', extra: 1 },
  ])('rechaza %j', (consulta) => {
    expect(validarEstadoLista(consulta).ok).toBe(false)
  })

  it.each([null, [], 'texto', 42])(
    'rechaza lo que no es objeto (%j)',
    (consulta) => {
      expect(validarEstadoLista(consulta).ok).toBe(false)
    },
  )
})

describe('validarIdUsuario', () => {
  it.each([
    ['3', 3],
    ['42', 42],
    ['123456789012345', 123456789012345],
  ])('acepta %j', (texto, numero) => {
    expect(validarIdUsuario(texto)).toEqual({ ok: true, datos: numero })
  })

  it.each([
    '0',
    '-1',
    '01',
    '1.5',
    '1e3',
    'abc',
    '',
    ' 3',
    '3; DROP TABLE usuarios',
    '1234567890123456',
    3,
    ['3'],
    undefined,
  ])('rechaza %j', (id) => {
    expect(validarIdUsuario(id).ok).toBe(false)
  })
})

describe('validarDecision', () => {
  it.each(['aprobado', 'rechazado'])('acepta %s', (decision) => {
    expect(validarDecision({ decision })).toEqual({ ok: true, datos: decision })
  })

  it.each([
    { decision: 'pendiente' },
    { decision: 'APROBADO' },
    { decision: ['aprobado'] },
    { decision: 'aprobado', extra: 1 },
    { rol: 'administrador' },
    {},
  ])('rechaza %j', (cuerpo) => {
    expect(validarDecision(cuerpo).ok).toBe(false)
  })

  it.each([null, [], 'texto', 42])(
    'rechaza lo que no es objeto (%j)',
    (cuerpo) => {
      expect(validarDecision(cuerpo).ok).toBe(false)
    },
  )
})
