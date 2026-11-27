import { describe, expect, it } from 'vitest'
import {
  COLCHON,
  crearRepeticion,
  desdeParaConsulta,
  recibirCambios,
  sembrar,
  valoresEn,
} from './repeticion'

const T0 = Date.parse('2026-11-26T20:00:00.000Z')
const en = (segundos: number, nodo: string, valor: number) => ({
  nodo,
  ts: new Date(T0 + segundos * 1000).toISOString(),
  valor,
})

function sembrada(ahora = 100) {
  const rep = crearRepeticion()
  sembrar(rep, { TAB_PASO: 0, TAB_SELLO: 0 }, T0 - 1000)
  return { rep, ahora }
}

describe('repetición de cambios', () => {
  it('sin sembrar no recibe nada ni sabe desde dónde pedir', () => {
    const rep = crearRepeticion()
    expect(desdeParaConsulta(rep)).toBeNull()
    recibirCambios(rep, [en(0, 'TAB_PASO', 2)], 0)
    expect(rep.eventos).toEqual([])
  })

  it('parte de los valores sembrados y pide desde su fecha', () => {
    const { rep } = sembrada()
    expect(valoresEn(rep, 0)).toEqual({ TAB_PASO: 0, TAB_SELLO: 0 })
    expect(desdeParaConsulta(rep)?.getTime()).toBe(T0 - 1000)
  })

  it('repite cada cambio con la misma distancia que tuvo, unos segundos después', () => {
    const { rep, ahora } = sembrada()
    recibirCambios(
      rep,
      [en(0, 'TAB_PASO', 6), en(0, 'TAB_SELLO', 1), en(0.4, 'TAB_SELLO', 0)],
      ahora,
    )
    expect(valoresEn(rep, ahora + COLCHON - 0.01).TAB_SELLO).toBe(0)
    expect(valoresEn(rep, ahora + COLCHON)).toEqual({
      TAB_PASO: 6,
      TAB_SELLO: 1,
    })
    expect(valoresEn(rep, ahora + COLCHON + 0.41).TAB_SELLO).toBe(0)
  })

  it('el siguiente lote guarda el mismo desfase', () => {
    const { rep, ahora } = sembrada()
    recibirCambios(rep, [en(0, 'TAB_PASO', 2)], ahora)
    recibirCambios(rep, [en(2, 'TAB_PASO', 3)], ahora + 2)
    expect(valoresEn(rep, ahora + COLCHON + 1.9).TAB_PASO).toBe(2)
    expect(valoresEn(rep, ahora + COLCHON + 2.01).TAB_PASO).toBe(3)
  })

  it('no repite lo que ya recibió, aunque la consulta lo vuelva a traer', () => {
    const { rep, ahora } = sembrada()
    recibirCambios(rep, [en(0, 'TAB_PASO', 2), en(1, 'TAB_SELLO', 1)], ahora)
    expect(desdeParaConsulta(rep)?.getTime()).toBe(T0 + 1000)
    // la siguiente pide desde el último ts (incluido): llega repetido y uno nuevo con el mismo ts
    recibirCambios(
      rep,
      [en(1, 'TAB_SELLO', 1), en(1, 'TAB_PASO', 6)],
      ahora + 2,
    )
    expect(rep.eventos.map((e) => `${e.nodo}=${e.valor}`)).toEqual([
      'TAB_PASO=2',
      'TAB_SELLO=1',
      'TAB_PASO=6',
    ])
  })

  it('el orden lo da la fecha, no el orden de llegada', () => {
    const { rep, ahora } = sembrada()
    recibirCambios(
      rep,
      [en(2, 'TAB_PASO', 4), en(0, 'TAB_PASO', 2), en(1, 'TAB_PASO', 3)],
      ahora,
    )
    expect(rep.eventos.map((e) => e.valor)).toEqual([2, 3, 4])
  })

  it('si quedó muy atrás (pestaña dormida), lo atrasado se aplica de golpe', () => {
    const { rep, ahora } = sembrada()
    recibirCambios(rep, [en(0, 'TAB_PASO', 2)], ahora)
    // diez minutos de la celda en una sola consulta
    recibirCambios(
      rep,
      [en(300, 'TAB_PASO', 5), en(600, 'TAB_PASO', 9)],
      ahora + 1,
    )
    expect(valoresEn(rep, ahora + 1).TAB_PASO).toBe(5)
    expect(valoresEn(rep, ahora + 1 + COLCHON).TAB_PASO).toBe(9)
  })

  it('un lote que llega tarde recorre la repetición, y luego se recupera poco a poco', () => {
    const { rep } = sembrada()
    recibirCambios(rep, [en(0, 'TAB_PASO', 2)], 100)
    // este llegó 6 s tarde: ya debió mostrarse en 105
    recibirCambios(rep, [en(1, 'TAB_PASO', 3)], 110)
    expect(rep.eventos.at(-1)?.t).toBeCloseTo(110.5)
    // los siguientes llegan a tiempo: el atraso extra se va quitando
    let anterior = Infinity
    for (let i = 0; i < 20; i++) {
      const ahora = 112 + i * 2
      recibirCambios(rep, [en(3 + i * 2, 'TAB_PASO', 4 + i)], ahora)
      const colchon = (rep.eventos.at(-1)?.t ?? 0) - ahora
      expect(colchon).toBeLessThanOrEqual(anterior + 1e-9)
      anterior = colchon
    }
    expect(anterior).toBeLessThanOrEqual(COLCHON + 1.01)
  })
})
