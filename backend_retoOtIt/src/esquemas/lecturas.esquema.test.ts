import { describe, expect, it } from 'vitest'
import { validarCuerpo } from './lecturas.esquema'

const AHORA = Date.parse('2026-10-28T16:00:00Z')

const lecturaValida = {
  estacion: '1500',
  ts_plc: '2026-10-28T15:59:00Z',
  nodo: 'TAB_PISTON_A',
  valor: 'True',
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
          estacion: '1500',
          tsPlc: new Date('2026-10-28T15:59:00Z'),
          nodo: 'TAB_PISTON_A',
          valor: 'True',
        },
      ],
    })
  })

  it('acepta las tres estaciones', () => {
    for (const estacion of ['300', '1500', '1200']) {
      expect(
        validarCuerpo({ lecturas: [{ ...lecturaValida, estacion }] }, AHORA).ok,
      ).toBe(true)
    }
  })

  it('acepta ts_plc vacío (null), como en la tabla', () => {
    const resultado = validarCuerpo(
      { lecturas: [{ ...lecturaValida, ts_plc: null }] },
      AHORA,
    )
    expect(resultado.ok && resultado.lecturas[0]?.tsPlc).toBeNull()
  })

  it('acepta milisegundos y microsegundos en la fecha', () => {
    for (const ts_plc of [
      '2026-10-28T15:59:00.123Z',
      '2026-10-28T15:59:00.123456Z',
    ]) {
      expect(
        validarCuerpo({ lecturas: [{ ...lecturaValida, ts_plc }] }, AHORA).ok,
      ).toBe(true)
    }
  })

  it.each(['True', 'False', '4', '0.0', '-3.5', '1.5e-3'])(
    'acepta el valor %s',
    (valor) => {
      expect(
        validarCuerpo({ lecturas: [{ ...lecturaValida, valor }] }, AHORA).ok,
      ).toBe(true)
    },
  )

  it.each([null, 'texto', 42, [], undefined])(
    'rechaza un cuerpo que no es objeto: %s',
    (cuerpo) => {
      expect(error(cuerpo)).toBe('El cuerpo debe ser un objeto JSON')
    },
  )

  it('rechaza estaciones desconocidas', () => {
    for (const estacion of ['S7-1200', '400', 1500, null]) {
      expect(error({ lecturas: [{ ...lecturaValida, estacion }] })).toBe(
        'lecturas[0]: estacion no permitida',
      )
    }
  })

  it('rechaza nodos vacíos, largos o con caracteres raros', () => {
    for (const nodo of ['', 'x'.repeat(101), "A'; DROP", 'con espacio', 5]) {
      expect(error({ lecturas: [{ ...lecturaValida, nodo }] })).toBe(
        'lecturas[0]: nodo no válido',
      )
    }
  })

  it('rechaza valores que no son texto corto', () => {
    for (const valor of [1, true, null, '', 'x'.repeat(65), 'a b', "1'"]) {
      expect(error({ lecturas: [{ ...lecturaValida, valor }] })).toContain(
        'lecturas[0]: valor',
      )
    }
  })

  it('rechaza fechas con formato incorrecto', () => {
    for (const ts_plc of [
      'hoy',
      '2026-10-28',
      '2026-10-28 15:59:00',
      '2026-10-28T15:59:00+01:00',
      20261028,
    ]) {
      expect(error({ lecturas: [{ ...lecturaValida, ts_plc }] })).toContain(
        'lecturas[0]: ts_plc',
      )
    }
  })

  it('rechaza fechas que no existen en el calendario', () => {
    const primeroDeDiciembre = Date.parse('2026-12-01T12:00:00Z')
    const resultado = validarCuerpo(
      { lecturas: [{ ...lecturaValida, ts_plc: '2026-11-31T10:00:00Z' }] },
      primeroDeDiciembre,
    )
    expect(resultado).toEqual({
      ok: false,
      error: 'lecturas[0]: ts_plc no es una fecha válida',
    })
  })

  it('respeta los límites de la ventana de fechas', () => {
    const dia = 24 * 60 * 60 * 1000
    const iso = (ms: number) => new Date(ms).toISOString()
    const ok = (ts_plc: string) =>
      validarCuerpo({ lecturas: [{ ...lecturaValida, ts_plc }] }, AHORA).ok

    expect(ok(iso(AHORA - 7 * dia))).toBe(true)
    expect(ok(iso(AHORA + 5 * 60 * 1000))).toBe(true)
    expect(
      error({
        lecturas: [{ ...lecturaValida, ts_plc: iso(AHORA - 7 * dia - 1000) }],
      }),
    ).toBe('lecturas[0]: ts_plc fuera del rango permitido')
    expect(
      error({
        lecturas: [
          { ...lecturaValida, ts_plc: iso(AHORA + 5 * 60 * 1000 + 1000) },
        ],
      }),
    ).toBe('lecturas[0]: ts_plc fuera del rango permitido')
  })

  it('rechaza campos que faltan o sobran', () => {
    const sinValor = {
      estacion: lecturaValida.estacion,
      ts_plc: lecturaValida.ts_plc,
      nodo: lecturaValida.nodo,
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
      '{"lecturas":[{"__proto__":{"x":1},"estacion":"300","nodo":"a","valor":"1"}]}',
    )
    expect(validarCuerpo(cuerpo, AHORA).ok).toBe(false)
  })
})
