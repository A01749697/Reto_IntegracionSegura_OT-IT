import { describe, expect, it } from 'vitest'
import type { UltimaLectura } from './apiLecturas'
import {
  estadoEnlace,
  piezasNuevas,
  resumirLecturas,
  SEGUNDOS_ATRASO,
  SIN_LECTURAS,
} from './enVivo'

const lectura = (
  variable: string,
  valor: number,
  ts = '2026-11-06T18:00:00.000Z',
  plc = 'S7-1500',
): UltimaLectura => ({ plc, variable, valor, ts })

describe('resumirLecturas', () => {
  it('sin lecturas todo queda sin dato', () => {
    expect(resumirLecturas([])).toEqual(SIN_LECTURAS)
  })

  it('acomoda cada variable en su campo', () => {
    expect(
      resumirLecturas([
        lectura('estado_estacion', 1),
        lectura('estado_piston', 0),
        lectura('presencia_pieza', 1),
        lectura('contador_piezas', 42, '2026-11-06T18:00:05.000Z'),
      ]),
    ).toEqual({
      estacion: 1,
      piston: 0,
      presencia: 1,
      contador: 42,
      ultima: '2026-11-06T18:00:05.000Z',
    })
  })

  it('si dos PLC mandan la misma variable se queda la más nueva', () => {
    const resumen = resumirLecturas([
      lectura('contador_piezas', 9, '2026-11-06T18:00:10.000Z', 'S7-1200'),
      lectura('contador_piezas', 7, '2026-11-06T18:00:00.000Z', 'S7-1500'),
    ])
    expect(resumen.contador).toBe(9)
    expect(resumen.ultima).toBe('2026-11-06T18:00:10.000Z')
  })

  it('ignora variables desconocidas y fechas que no se entienden', () => {
    expect(
      resumirLecturas([
        lectura('temperatura', 80),
        lectura('toString', 1),
        lectura('contador_piezas', 3, 'ayer'),
      ]),
    ).toEqual(SIN_LECTURAS)
  })
})

describe('piezasNuevas', () => {
  it.each([
    [null, 10, 0], // la primera lectura es el punto de partida
    [10, null, 0],
    [10, 10, 0],
    [10, 13, 3],
    [10, 2, 0], // reiniciaron el contador
    [10, 11.9, 1],
  ])('de %s a %s son %s', (anterior, actual, esperado) => {
    expect(piezasNuevas(anterior, actual)).toBe(esperado)
  })
})

describe('estadoEnlace', () => {
  const ahora = Date.parse('2026-11-06T18:10:00.000Z')
  const hace = (segundos: number) => ({
    ...SIN_LECTURAS,
    ultima: new Date(ahora - segundos * 1000).toISOString(),
  })

  it('sin lecturas lo dice', () => {
    expect(estadoEnlace(SIN_LECTURAS, ahora)).toBe('sin_lecturas')
  })

  it('con una lectura reciente está en vivo', () => {
    expect(estadoEnlace(hace(10), ahora)).toBe('en_vivo')
    expect(estadoEnlace(hace(SEGUNDOS_ATRASO), ahora)).toBe('en_vivo')
  })

  it('pasado el tiempo de atraso avisa', () => {
    expect(estadoEnlace(hace(SEGUNDOS_ATRASO + 1), ahora)).toBe('atrasado')
  })
})
