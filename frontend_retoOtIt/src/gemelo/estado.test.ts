import { describe, expect, it } from 'vitest'
import {
  estadoCelda,
  lucesTorreta,
  sinLatido,
  vigilarLatido,
  type Latido,
} from './estado'
import { NODO } from './nodos'

const con = (torreta: number, falla = 0) => ({
  [NODO.torreta]: torreta,
  [NODO.falla]: falla,
})

describe('estadoCelda', () => {
  it.each([
    [1, 0, 'marcha'],
    [2, 0, 'mantenimiento'],
    [3, 0, 'paro'],
    [3, 1, 'falla'],
    [4, 0, 'reset'],
    [0, 0, 'sinDato'],
    [9, 0, 'sinDato'],
  ] as const)(
    'TAB_TORRETA %i y TAB_FALLA %i → %s',
    (torreta, falla, estado) => {
      expect(estadoCelda(con(torreta, falla), false)).toBe(estado)
    },
  )

  it('sin comunicación gana sobre todo', () => {
    expect(estadoCelda(con(1), true)).toBe('sinComunicacion')
  })

  it('sin el nodo de la torreta, sin dato', () => {
    expect(estadoCelda({}, false)).toBe('sinDato')
  })
})

describe('lucesTorreta', () => {
  it('una sola luz a la vez', () => {
    expect(lucesTorreta(1, false, 0)).toEqual({
      verde: true,
      amarilla: false,
      roja: false,
      gris: false,
    })
    expect(lucesTorreta(2, false, 0.7).amarilla).toBe(true)
    expect(lucesTorreta(3, false, 0).roja).toBe(true)
  })

  it('el reset parpadea en amarillo a 1 Hz', () => {
    expect(lucesTorreta(4, false, 10.2).amarilla).toBe(true)
    expect(lucesTorreta(4, false, 10.7).amarilla).toBe(false)
    expect(lucesTorreta(4, false, 11.2).amarilla).toBe(true)
  })

  it('cualquier otro valor: todas apagadas', () => {
    expect(lucesTorreta(5, false, 0)).toEqual({
      verde: false,
      amarilla: false,
      roja: false,
      gris: false,
    })
  })

  it('sin comunicación: apagadas y en gris', () => {
    expect(lucesTorreta(1, true, 0)).toEqual({
      verde: false,
      amarilla: false,
      roja: false,
      gris: true,
    })
  })
})

describe('latido', () => {
  it('se vigila desde que cambia por primera vez', () => {
    let latido = vigilarLatido(
      { valor: undefined, cambio: 0, vigilado: false },
      7,
      1,
    )
    // un solo valor (el colector no lo guarda): no se puede saber nada
    expect(latido.vigilado).toBe(false)
    expect(sinLatido(latido, 60)).toBe(false)
    latido = vigilarLatido(latido, 8, 2)
    expect(latido).toEqual({ valor: 8, cambio: 2, vigilado: true })
  })

  it('ya vigilado, se da por perdido si no cambia en más de 5 s', () => {
    let latido: Latido = { valor: 8, cambio: 2, vigilado: true }
    latido = vigilarLatido(latido, 8, 6)
    expect(sinLatido(latido, 6.9)).toBe(false)
    expect(sinLatido(latido, 7.1)).toBe(true)
    latido = vigilarLatido(latido, 9, 7.2)
    expect(sinLatido(latido, 7.3)).toBe(false)
  })
})
