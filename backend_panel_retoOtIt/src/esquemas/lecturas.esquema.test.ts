import { describe, expect, it } from 'vitest'
import {
  validarConsultaCambios,
  validarConsultaHistorial,
  validarConsultaIndicadores,
} from './lecturas.esquema'

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

  it.each(['', 'S7-400', "S7';--", 'S7 1200', '300', 123, ['S7-1200']])(
    'rechaza el plc %j',
    (plc) => {
      expect(validarConsultaHistorial({ ...consultaValida, plc }).ok).toBe(
        false,
      )
    },
  )

  it.each(["TAB_A';--", 'con espacio', 'a'.repeat(101), '', 7])(
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

describe('validarConsultaIndicadores', () => {
  const limites = { maximoDias: 93, maximoCubetas: 100 }
  const base = {
    desde: '2026-11-01T06:00:00Z',
    hasta: '2026-11-08T06:00:00Z',
    cubeta: 'dia',
  }

  it('acepta un periodo en días u horas', () => {
    expect(validarConsultaIndicadores(base, limites)).toEqual({
      ok: true,
      consulta: {
        desde: new Date('2026-11-01T06:00:00Z'),
        hasta: new Date('2026-11-08T06:00:00Z'),
        cubetaSegundos: 86400,
      },
    })
    const hoy = { ...base, hasta: '2026-11-02T06:00:00Z', cubeta: 'hora' }
    expect(validarConsultaIndicadores(hoy, limites).ok).toBe(true)
  })

  it.each([
    [{ ...base, cubeta: 'minuto' }],
    [{ ...base, extra: '1' }],
    [{ desde: base.desde, hasta: base.hasta }],
    [{ ...base, desde: 'ayer' }],
    [{ ...base, desde: base.hasta }],
    [{ ...base, hasta: '2027-03-01T06:00:00Z' }], // más de 93 días
    [{ ...base, cubeta: 'hora' }], // 168 tramos de una hora
  ])('rechaza %o', (consulta) => {
    expect(validarConsultaIndicadores(consulta, limites).ok).toBe(false)
  })
})

describe('validarConsultaCambios', () => {
  const base = {
    plc: 'S7-1500',
    nodos: 'TAB_PASO,TAB_SELLO,TAB_PASO',
    desde: '2026-11-25T20:00:00.000Z',
  }

  it('acepta una lista de nodos sin repetir', () => {
    expect(validarConsultaCambios(base, 40)).toEqual({
      ok: true,
      consulta: {
        plc: 'S7-1500',
        nodos: ['TAB_PASO', 'TAB_SELLO'],
        desde: new Date(base.desde),
      },
    })
  })

  it.each([
    [{ ...base, plc: 'S7-9' }],
    [{ ...base, nodos: "TAB_PASO,x';--" }],
    [{ ...base, nodos: '' }],
    [
      {
        ...base,
        nodos: Array.from({ length: 41 }, (_, i) => `N${i}`).join(','),
      },
    ],
    [{ ...base, desde: 'ayer' }],
    [{ plc: base.plc, nodos: base.nodos }],
  ])('rechaza %o', (consulta) => {
    expect(validarConsultaCambios(consulta, 40).ok).toBe(false)
  })
})
