import { describe, expect, it } from 'vitest'
import { validarCuerpo } from './lecturas.esquema'

const AHORA = Date.parse('2026-10-28T16:00:00Z')

const lecturaValida = {
  ts: '2026-10-28T15:59:00Z',
  plc: 'S7-1200',
  variable: 'estado_piston',
  valor: 1,
}

function error(cuerpo: unknown): string {
  const resultado = validarCuerpo(cuerpo, AHORA)
  if (resultado.ok) throw new Error('Se esperaba un error de validación')
  return resultado.error
}

describe('validarCuerpo', () => {
  it('acepta una lectura válida y convierte la fecha', () => {
    const resultado = validarCuerpo({ lecturas: [lecturaValida] }, AHORA)
    expect(resultado).toEqual({
      ok: true,
      lecturas: [
        {
          ts: new Date('2026-10-28T15:59:00Z'),
          plc: 'S7-1200',
          variable: 'estado_piston',
          valor: 1,
        },
      ],
    })
  })

  it('acepta milisegundos en la fecha', () => {
    const lectura = { ...lecturaValida, ts: '2026-10-28T15:59:00.123Z' }
    expect(validarCuerpo({ lecturas: [lectura] }, AHORA).ok).toBe(true)
  })

  it('acepta valores negativos y decimales', () => {
    const lectura = { ...lecturaValida, valor: -3.5 }
    expect(validarCuerpo({ lecturas: [lectura] }, AHORA).ok).toBe(true)
  })

  it.each([null, 'texto', 42, [], undefined])(
    'rechaza un cuerpo que no es objeto: %s',
    (cuerpo) => {
      expect(error(cuerpo)).toBe('El cuerpo debe ser un objeto JSON')
    },
  )

  it('rechaza valores que no son números finitos', () => {
    for (const valor of [NaN, Infinity, -Infinity, 1e13, '5', null]) {
      expect(error({ lecturas: [{ ...lecturaValida, valor }] })).toBe(
        'lecturas[0]: valor debe ser un número finito',
      )
    }
  })

  it('rechaza fechas con formato incorrecto', () => {
    for (const ts of [
      'hoy',
      '2026-10-28',
      '2026-10-28 15:59:00',
      '2026-10-28T15:59:00+01:00',
      20261028,
    ]) {
      expect(error({ lecturas: [{ ...lecturaValida, ts }] })).toContain(
        'lecturas[0]: ts',
      )
    }
  })

  it('rechaza fechas que no existen en el calendario', () => {
    // 31 de noviembre: sin la revisión, JavaScript lo convertiría en 1 de diciembre
    const primeroDeDiciembre = Date.parse('2026-12-01T12:00:00Z')
    const resultado = validarCuerpo(
      { lecturas: [{ ...lecturaValida, ts: '2026-11-31T10:00:00Z' }] },
      primeroDeDiciembre,
    )
    expect(resultado).toEqual({
      ok: false,
      error: 'lecturas[0]: ts no es una fecha válida',
    })
    expect(
      error({ lecturas: [{ ...lecturaValida, ts: '2026-13-01T10:00:00Z' }] }),
    ).toBe('lecturas[0]: ts no es una fecha válida')
  })

  it('respeta los límites de la ventana de fechas', () => {
    const justoPasado = new Date(AHORA - 7 * 24 * 60 * 60 * 1000).toISOString()
    const justoFuturo = new Date(AHORA + 5 * 60 * 1000).toISOString()
    const muyPasado = new Date(
      AHORA - 7 * 24 * 60 * 60 * 1000 - 1000,
    ).toISOString()
    const muyFuturo = new Date(AHORA + 5 * 60 * 1000 + 1000).toISOString()

    expect(
      validarCuerpo(
        { lecturas: [{ ...lecturaValida, ts: justoPasado }] },
        AHORA,
      ).ok,
    ).toBe(true)
    expect(
      validarCuerpo(
        { lecturas: [{ ...lecturaValida, ts: justoFuturo }] },
        AHORA,
      ).ok,
    ).toBe(true)
    expect(error({ lecturas: [{ ...lecturaValida, ts: muyPasado }] })).toBe(
      'lecturas[0]: ts fuera del rango permitido',
    )
    expect(error({ lecturas: [{ ...lecturaValida, ts: muyFuturo }] })).toBe(
      'lecturas[0]: ts fuera del rango permitido',
    )
  })

  it('rechaza campos que faltan o sobran', () => {
    const sinValor = {
      ts: lecturaValida.ts,
      plc: lecturaValida.plc,
      variable: lecturaValida.variable,
    }
    expect(error({ lecturas: [sinValor] })).toContain('exactamente los campos')
    expect(error({ lecturas: [{ ...lecturaValida, extra: 1 }] })).toContain(
      'exactamente los campos',
    )
  })

  it('rechaza una lectura que no es objeto', () => {
    expect(error({ lecturas: [null] })).toBe('lecturas[0]: debe ser un objeto')
    expect(error({ lecturas: ['texto'] })).toBe(
      'lecturas[0]: debe ser un objeto',
    )
  })

  it('rechaza claves peligrosas', () => {
    const cuerpo = JSON.parse(
      '{"lecturas":[{"__proto__":{"x":1},"ts":"a","plc":"b","variable":"c"}]}',
    )
    expect(validarCuerpo(cuerpo, AHORA).ok).toBe(false)
  })
})
