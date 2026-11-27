import { describe, expect, it } from 'vitest'
import type { Tramo } from './apiIndicadores'
import {
  cambioEnPuntos,
  cambioRelativo,
  cicloPromedio,
  csvDeTramos,
  fallasPorCodigo,
  disponibilidad,
  piezasPorHora,
  sumar,
  ventanas,
} from './resumen'

const tramo = (cambios: Partial<Tramo>): Tramo => ({
  inicio: '2026-11-24T06:00:00.000Z',
  aluminio: 0,
  plastico: 0,
  marcha: 0,
  mantenimiento: 0,
  paro: 0,
  sinRegistro: 0,
  paros: 0,
  fallas: 0,
  ciclos: 0,
  segundosCiclo: 0,
  ...cambios,
})

describe('ventanas', () => {
  const ahora = new Date(2026, 10, 25, 15, 30) // 25 nov, 15:30 hora local

  it('hoy va de la medianoche a la siguiente, por hora; el anterior es ayer', () => {
    const { actual, anterior } = ventanas('hoy', ahora)
    expect(actual.desde).toEqual(new Date(2026, 10, 25))
    expect(actual.hasta).toEqual(new Date(2026, 10, 26))
    expect(actual.cubeta).toBe('hora')
    expect(anterior.desde).toEqual(new Date(2026, 10, 24))
    expect(anterior.hasta).toEqual(actual.desde)
  })

  it('7 y 30 días terminan hoy y van por día', () => {
    const siete = ventanas('7d', ahora)
    expect(siete.actual.desde).toEqual(new Date(2026, 10, 19))
    expect(siete.actual.cubeta).toBe('dia')
    expect(siete.anterior.desde).toEqual(new Date(2026, 10, 12))
    expect(ventanas('30d', ahora).actual.desde).toEqual(new Date(2026, 9, 27))
  })
})

describe('indicadores', () => {
  const tramos = [
    tramo({
      aluminio: 3,
      plastico: 5,
      marcha: 1800,
      paro: 600,
      ciclos: 2,
      segundosCiclo: 30,
    }),
    tramo({
      aluminio: 1,
      plastico: 1,
      marcha: 1800,
      sinRegistro: 3600,
      paros: 2,
      ciclos: 1,
      segundosCiclo: 18,
    }),
  ]
  const total = sumar(tramos)

  it('suma los tramos', () => {
    expect(total).toMatchObject({
      piezas: 10,
      aluminio: 4,
      marcha: 3600,
      paros: 2,
    })
  })

  it('disponibilidad no cuenta el tiempo sin registro', () => {
    expect(disponibilidad(total)).toBeCloseTo((3600 / 4200) * 100)
    expect(disponibilidad(tramo({}))).toBeNull()
  })

  it('piezas por hora en marcha y ciclo promedio', () => {
    expect(piezasPorHora(total)).toBe(10)
    expect(cicloPromedio(total)).toBe(16)
    expect(cicloPromedio(tramo({}))).toBeNull()
  })

  it('compara contra el anterior en porcentaje o en puntos', () => {
    expect(cambioRelativo(120, 100)).toBeCloseTo(20)
    expect(cambioRelativo(5, 0)).toBeNull()
    expect(cambioRelativo(5, null)).toBeNull()
    expect(cambioEnPuntos(85, 90)).toBe(-5)
  })

  it('el CSV trae una fila por tramo', () => {
    const csv = csvDeTramos(tramos, ['a', 'b'])
    const filas = csv.trim().split('\r\n')
    expect(filas).toHaveLength(3)
    expect(filas[0]).toBe('a,b')
    expect(filas[1]).toBe(
      '2026-11-24T06:00:00.000Z,3,5,8,0.50,0.00,0.17,0.00,75.0,0,0,2,15.0',
    )
  })
})

it('fallasPorCodigo cuenta y ordena de la más frecuente a la menos', () => {
  expect(
    fallasPorCodigo([
      { codigo: 2 },
      { codigo: 5 },
      { codigo: 5 },
      { codigo: null },
    ]),
  ).toEqual([
    { codigo: 5, veces: 2 },
    { codigo: null, veces: 1 },
    { codigo: 2, veces: 1 },
  ])
})
