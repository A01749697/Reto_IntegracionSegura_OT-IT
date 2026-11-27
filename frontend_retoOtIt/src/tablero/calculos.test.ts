import { describe, expect, it } from 'vitest'
import {
  duracionesDeCiclo,
  ESTADO_FALLA,
  estadosDeLaCelda,
  fallasEnVentana,
  segundosLegibles,
  valoresEnVentana,
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

describe('estados, fallas y valores por ciclo', () => {
  it('combina la torreta y la falla: 3 con TAB_FALLA es falla', () => {
    const estados = estadosDeLaCelda(
      [en(0, 1), en(10, 3), en(20, 3)],
      [en(0, 0), en(10, 1), en(15, 0)],
    )
    expect(
      tramos(estados, ventana(0, 30)).map((t) => [
        t.valor,
        (t.fin - t.inicio) / 1000,
      ]),
    ).toEqual([
      [1, 10],
      [ESTADO_FALLA, 5],
      [3, 15],
    ])
  })

  it('cada falla con su código y cuándo se borró', () => {
    const fallas = fallasEnVentana(
      [en(-5, 1), en(2, 0), en(10, 1), en(20, 0), en(25, 1)],
      [en(-5, 9), en(10.5, 4), en(25, 6)],
      ventana(0, 30),
    )
    // la de antes de la ventana no cuenta; la última sigue activa
    expect(fallas).toEqual([
      { inicio: T0 + 10_000, fin: T0 + 20_000, codigo: 4 },
      { inicio: T0 + 25_000, fin: null, codigo: 6 },
    ])
  })

  it('valores por ciclo dentro de la ventana, sin ceros', () => {
    expect(
      valoresEnVentana([en(-1, 9), en(5, 0), en(6, 10)], ventana(0, 30)),
    ).toEqual([en(6, 10)])
  })

  it('segundosLegibles', () => {
    expect(segundosLegibles(45)).toBe('45 s')
    expect(segundosLegibles(200)).toBe('3 min 20 s')
    expect(segundosLegibles(3600 * 2 + 300)).toBe('2 h 5 min')
  })
})
