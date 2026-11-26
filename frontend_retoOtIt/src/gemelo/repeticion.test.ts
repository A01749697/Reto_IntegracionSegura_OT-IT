import { describe, expect, it } from 'vitest'
import { COLCHON, crearRepeticion, pasoEn, recibirPasos } from './repeticion'

const T0 = Date.parse('2026-11-24T20:00:00.000Z')
const punto = (segundos: number, valor: number) => ({
  ts: new Date(T0 + segundos * 1000).toISOString(),
  valor,
})

// Una repetición que ya pasó por la primera consulta.
function iniciada(ahora = 100) {
  const rep = crearRepeticion()
  recibirPasos(rep, [punto(-60, 0)], ahora)
  return rep
}

describe('recibirPasos y pasoEn', () => {
  it('la primera consulta solo deja el último paso, sin repetir la historia', () => {
    const rep = crearRepeticion()
    recibirPasos(rep, [punto(0, 2), punto(1, 3), punto(2, 9)], 100)
    expect(rep.eventos).toEqual([])
    expect(pasoEn(rep, 100)).toBe(9)
  })

  it('repite cada cambio con la misma distancia que tuvo en la celda, unos segundos después', () => {
    const rep = iniciada()
    recibirPasos(rep, [punto(0, 2), punto(1.5, 3), punto(4, 4)], 100)
    expect(pasoEn(rep, 100 + COLCHON - 0.01)).toBe(0)
    expect(pasoEn(rep, 100 + COLCHON)).toBe(2)
    expect(pasoEn(rep, 100 + COLCHON + 1.49)).toBe(2)
    expect(pasoEn(rep, 100 + COLCHON + 1.5)).toBe(3)
    expect(pasoEn(rep, 100 + COLCHON + 4)).toBe(4)
  })

  it('los de la siguiente consulta guardan el mismo desfase', () => {
    const rep = iniciada()
    recibirPasos(rep, [punto(0, 2)], 100)
    recibirPasos(rep, [punto(5, 3)], 105)
    expect(pasoEn(rep, 100 + COLCHON + 4.9)).toBe(2)
    expect(pasoEn(rep, 100 + COLCHON + 5)).toBe(3)
  })

  it('no repite lo que ya recibió', () => {
    const rep = iniciada()
    recibirPasos(rep, [punto(0, 2), punto(1, 3)], 100)
    recibirPasos(rep, [punto(0, 2), punto(1, 3), punto(2, 4)], 105)
    expect(rep.eventos.map((e) => e.paso)).toEqual([2, 3, 4])
  })

  it('el orden lo da la fecha, no el orden en que llegan', () => {
    const rep = iniciada()
    recibirPasos(rep, [punto(2, 4), punto(0, 2), punto(1, 3)], 100)
    expect(rep.eventos.map((e) => e.paso)).toEqual([2, 3, 4])
  })

  it('si la animación se quedó muy atrás (pestaña dormida), se reancla', () => {
    const rep = iniciada()
    recibirPasos(rep, [punto(0, 2)], 100)
    pasoEn(rep, 200)
    // diez minutos después en la celda, pero el reloj del gemelo apenas avanzó
    recibirPasos(rep, [punto(600, 5)], 110)
    expect(rep.eventos[0].t).toBeCloseTo(110 + COLCHON)
  })
})
