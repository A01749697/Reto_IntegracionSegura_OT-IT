import { describe, expect, it } from 'vitest'
import {
  duracionesDeCiclo,
  piezasPorTramo,
  resumir,
  tiempoPorValor,
  totalContador,
  tramos,
  type Punto,
} from './calculos'

const T0 = Date.parse('2026-11-24T20:00:00.000Z')
const en = (segundos: number, valor: number): Punto => ({
  ts: new Date(T0 + segundos * 1000).toISOString(),
  valor,
})
const ventana = (desde: number, hasta: number) => ({
  desde: T0 + desde * 1000,
  hasta: T0 + hasta * 1000,
})

describe('contadores', () => {
  it('cuenta lo que subió en cada tramo, desde el valor que tenía al empezar', () => {
    const al = [en(-10, 50), en(5, 51), en(15, 52), en(16, 53)]
    const pl = [en(-10, 200), en(25, 202)]
    const cubetas = piezasPorTramo(al, pl, ventana(0, 30), 3)
    expect(cubetas.map((c) => [c.al, c.pl])).toEqual([
      [1, 0],
      [2, 0],
      [0, 2],
    ])
    expect(cubetas[1].inicio).toBe(T0 + 10_000)
  })

  it('un reinicio del contador no resta piezas', () => {
    const puntos = [en(-1, 300), en(5, 0), en(6, 1), en(7, 2)]
    expect(totalContador(puntos, ventana(0, 10))).toBe(2)
  })

  it('sin datos antes de la ventana, el primer valor solo sirve de base', () => {
    expect(totalContador([en(1, 10), en(2, 11)], ventana(0, 10))).toBe(1)
  })
})

describe('tramos y tiempos', () => {
  it('parte la ventana por valor, empezando con el que había antes', () => {
    const torreta = [en(-50, 3), en(10, 1), en(10.5, 1), en(40, 3)]
    expect(
      tramos(torreta, ventana(0, 60)).map((t) => [
        t.valor,
        (t.fin - t.inicio) / 1000,
      ]),
    ).toEqual([
      [3, 10],
      [1, 30],
      [3, 20],
    ])
    expect(tiempoPorValor(torreta, ventana(0, 60)).get(3)).toBe(30)
  })

  it('antes del primer dato no inventa nada', () => {
    expect(tramos([en(20, 1)], ventana(0, 30))).toEqual([
      { valor: 1, inicio: T0 + 20_000, fin: T0 + 30_000 },
    ])
  })
})

describe('duracionesDeCiclo', () => {
  it('mide de que sale del reposo a que vuelve a empezar, solo ciclos completos', () => {
    const pasos = [
      en(-5, 4), // ciclo a medias al empezar: no cuenta
      en(1, 9),
      en(2, 0),
      en(3, 2),
      en(10, 8),
      en(15, 9),
      en(16, 0),
      en(17, 1),
      en(18, 2), // va a medias al final: no cuenta
    ]
    expect(duracionesDeCiclo(pasos, ventana(0, 30))).toEqual([13])
  })

  it('si el historian no vio el reposo, el ciclo siguiente empieza al regresar', () => {
    const pasos = [en(-5, 0), en(1, 2), en(9, 9), en(10, 2), en(20, 0)]
    expect(duracionesDeCiclo(pasos, ventana(0, 30))).toEqual([9, 10])
  })
})

it('resumir', () => {
  expect(resumir([])).toBeNull()
  expect(resumir([10, 20, 30])).toEqual({
    promedio: 20,
    minimo: 10,
    maximo: 30,
  })
})
