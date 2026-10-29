import { describe, expect, it } from 'vitest'
import { validarConsultaHistorial } from './lecturas.esquema'

const consultaValida = {
  plc: 'S7-1500',
  variable: 'contador_piezas',
  desde: '2026-10-28T16:00:00Z',
  hasta: '2026-10-28T17:00:00Z',
}

describe('validarConsultaHistorial', () => {
  it('acepta una consulta válida y convierte las fechas', () => {
    expect(validarConsultaHistorial(consultaValida)).toEqual({
      ok: true,
      consulta: {
        plc: 'S7-1500',
        variable: 'contador_piezas',
        desde: new Date('2026-10-28T16:00:00Z'),
        hasta: new Date('2026-10-28T17:00:00Z'),
      },
    })
  })

  it('acepta fechas con milisegundos', () => {
    const resultado = validarConsultaHistorial({
      ...consultaValida,
      desde: '2026-10-28T16:00:00.250Z',
    })
    expect(resultado.ok).toBe(true)
  })

  it.each([null, [], 'texto', 42])(
    'rechaza lo que no es objeto (%j)',
    (consulta) => {
      expect(validarConsultaHistorial(consulta).ok).toBe(false)
    },
  )

  it('rechaza un campo de más o un campo faltante', () => {
    expect(validarConsultaHistorial({ ...consultaValida, extra: 1 }).ok).toBe(
      false,
    )
    const sinHasta: Record<string, unknown> = { ...consultaValida }
    delete sinHasta.hasta
    expect(validarConsultaHistorial(sinHasta).ok).toBe(false)
  })

  it.each(['', 'a'.repeat(21), "S7';--", 'S7 1200', 123, ['S7-1200']])(
    'rechaza el plc %j',
    (plc) => {
      expect(validarConsultaHistorial({ ...consultaValida, plc }).ok).toBe(
        false,
      )
    },
  )

  it.each(['Contador', '1abc', 'a-b', 'a'.repeat(65), '', 7])(
    'rechaza la variable %j',
    (variable) => {
      expect(validarConsultaHistorial({ ...consultaValida, variable }).ok).toBe(
        false,
      )
    },
  )

  it.each([
    '2026-10-28',
    '2026-10-28T16:00:00',
    '2026-10-28T16:00:00+00:00',
    '2026-11-31T00:00:00Z',
    '2026-13-01T00:00:00Z',
    'ayer',
    123,
  ])('rechaza la fecha %j', (fecha) => {
    expect(
      validarConsultaHistorial({ ...consultaValida, desde: fecha }).ok,
    ).toBe(false)
    expect(
      validarConsultaHistorial({ ...consultaValida, hasta: fecha }).ok,
    ).toBe(false)
  })

  it('rechaza si desde es igual o posterior a hasta', () => {
    const igual = { ...consultaValida, hasta: consultaValida.desde }
    expect(validarConsultaHistorial(igual).ok).toBe(false)
    const alReves = {
      ...consultaValida,
      desde: consultaValida.hasta,
      hasta: consultaValida.desde,
    }
    expect(validarConsultaHistorial(alReves).ok).toBe(false)
  })
})
