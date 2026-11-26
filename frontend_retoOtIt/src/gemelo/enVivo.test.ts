import { describe, expect, it } from 'vitest'
import type { UltimaLectura } from './apiLecturas'
import {
  colorTorreta,
  compararTorreta,
  estadoEnlace,
  latidoDetenido,
  marchaPorTorreta,
  piezasNuevas,
  MAXIMO_POR_CONSULTA,
  resumirLecturas,
  SEGUNDOS_ATRASO,
  SEGUNDOS_LATIDO,
  SIN_LECTURAS,
  vigilarLatido,
} from './enVivo'
import { ESTADOS_TORRETA, NODOS } from './nodos'

const lectura = (
  plc: string,
  variable: string,
  valor: number,
  ts = '2026-11-06T18:00:00.000Z',
): UltimaLectura => ({ plc, variable, valor, ts })

const torreta = (estado: number) => [
  lectura(NODOS.torreta.plc, NODOS.torreta.nodo, estado),
]

describe('resumirLecturas', () => {
  it('sin lecturas todo queda sin dato', () => {
    expect(resumirLecturas([])).toEqual(SIN_LECTURAS)
  })

  it('reconoce la torreta y el latido por su nodo y estación', () => {
    const resumen = resumirLecturas([
      ...torreta(ESTADOS_TORRETA.verde),
      lectura(NODOS.latido.plc, NODOS.latido.nodo, 42),
    ])
    expect(resumen.torreta).toBe(ESTADOS_TORRETA.verde)
    expect(resumen.latido).toBe(42)
  })

  it('un nodo con el mismo nombre pero de otra estación no es la torreta', () => {
    const resumen = resumirLecturas([
      lectura('S7-300', NODOS.torreta.nodo, ESTADOS_TORRETA.verde),
    ])
    expect(resumen.torreta).toBeNull()
    expect(resumen.estaciones['S7-300']).toHaveLength(1)
  })

  it('agrupa todos los nodos por estación, ordenados por nombre', () => {
    const resumen = resumirLecturas([
      lectura('S7-1500', 'TAB_PISTON_B', 0),
      lectura('S7-1500', 'TAB_PISTON_A', 1),
      lectura('S7-300', 'CONTADOR', 9),
    ])
    expect(resumen.estaciones['S7-1500'].map((n) => n.nodo)).toEqual([
      'TAB_PISTON_A',
      'TAB_PISTON_B',
    ])
    expect(resumen.estaciones['S7-300'][0]).toMatchObject({
      nodo: 'CONTADOR',
      valor: 9,
    })
    expect(resumen.estaciones['S7-1200']).toEqual([])
  })

  it('se queda con la fecha más reciente', () => {
    const resumen = resumirLecturas([
      lectura('S7-300', 'A', 1, '2026-11-06T18:00:00.000Z'),
      lectura('S7-300', 'B', 1, '2026-11-06T18:00:09.000Z'),
    ])
    expect(resumen.ultima).toBe('2026-11-06T18:00:09.000Z')
  })

  it('ignora estaciones desconocidas y fechas que no se entienden', () => {
    const resumen = resumirLecturas([
      lectura('S7-400', 'A', 1),
      lectura('S7-300', 'B', 1, 'ayer'),
    ])
    expect(resumen).toEqual(SIN_LECTURAS)
  })
})

describe('colorTorreta', () => {
  it('traduce el estado del nodo a un color', () => {
    const color = (estado: number) => colorTorreta(estado)
    expect(color(ESTADOS_TORRETA.verde)).toBe('verde')
    expect(color(ESTADOS_TORRETA.roja)).toBe('roja')
    expect(color(ESTADOS_TORRETA.amarilla)).toBe('amarilla')
    expect(color(99)).toBe('otro')
    expect(colorTorreta(null)).toBeNull()
  })
})

describe('marchaPorTorreta', () => {
  it('el estado verde es marcha', () => {
    expect(
      marchaPorTorreta(resumirLecturas(torreta(ESTADOS_TORRETA.verde))),
    ).toBe(true)
  })

  it('roja, amarilla o un estado desconocido es paro', () => {
    for (const estado of [
      ESTADOS_TORRETA.roja,
      ESTADOS_TORRETA.amarilla,
      0,
      99,
    ])
      expect(marchaPorTorreta(resumirLecturas(torreta(estado)))).toBe(false)
  })

  it('sin dato de la torreta la celda queda en paro', () => {
    expect(marchaPorTorreta(SIN_LECTURAS)).toBe(false)
  })
})

describe('estadoEnlace', () => {
  const ahora = Date.parse('2026-11-06T18:00:00.000Z')

  it('sin lecturas lo dice', () => {
    expect(estadoEnlace(SIN_LECTURAS, ahora)).toBe('sin_lecturas')
  })

  it('con una lectura reciente está en vivo', () => {
    const resumen = resumirLecturas([lectura('S7-300', 'A', 1)])
    expect(estadoEnlace(resumen, ahora + 1000)).toBe('en_vivo')
  })

  it('pasado el tiempo de atraso avisa', () => {
    const resumen = resumirLecturas([lectura('S7-300', 'A', 1)])
    expect(estadoEnlace(resumen, ahora + SEGUNDOS_ATRASO * 1000 + 1)).toBe(
      'atrasado',
    )
  })
})

describe('compararTorreta', () => {
  const con = (tablero: number, real: number) =>
    compararTorreta(
      resumirLecturas([
        lectura(NODOS.torreta.plc, NODOS.torreta.nodo, tablero),
        lectura(NODOS.torretaReal.plc, NODOS.torretaReal.nodo, real),
      ]),
    )

  it('mientras no llegue TORRETA_REAL no compara nada', () => {
    expect(compararTorreta(resumirLecturas(torreta(1)))).toBeNull()
  })

  it('el mismo color coincide', () => {
    expect(con(ESTADOS_TORRETA.verde, ESTADOS_TORRETA.verde)).toBe('coincide')
  })

  it('colores distintos se avisan', () => {
    expect(con(ESTADOS_TORRETA.verde, ESTADOS_TORRETA.roja)).toBe('distinta')
  })

  it('0 (ninguna luz o varias) se avisa aparte', () => {
    expect(con(ESTADOS_TORRETA.roja, 0)).toBe('luces')
  })
})

describe('vigilarLatido', () => {
  const t0 = 1_000_000

  it('mientras el latido cambie no hay alarma, aunque cambie despacio', () => {
    let vigia = vigilarLatido(null, 10, t0)
    vigia = vigilarLatido(vigia, 11, t0 + (SEGUNDOS_LATIDO - 1) * 1000)
    expect(latidoDetenido(vigia, t0 + (SEGUNDOS_LATIDO + 5) * 1000)).toBeNull()
  })

  it('si no cambia en el límite, avisa cuántos segundos lleva quieto', () => {
    let vigia = vigilarLatido(null, 10, t0)
    vigia = vigilarLatido(vigia, 10, t0 + 5000)
    expect(latidoDetenido(vigia, t0 + 5000)).toBeNull()
    expect(latidoDetenido(vigia, t0 + SEGUNDOS_LATIDO * 1000)).toBe(
      SEGUNDOS_LATIDO,
    )
  })

  it('sin latido no hay nada que vigilar', () => {
    expect(vigilarLatido({ valor: 3, desde: t0 }, null, t0)).toBeNull()
    expect(latidoDetenido(null, t0 + 99_000)).toBeNull()
  })
})

describe('piezasNuevas', () => {
  const con = (al: number | null, pl: number | null) =>
    resumirLecturas([
      ...(al === null
        ? []
        : [lectura(NODOS.piezasAluminio.plc, NODOS.piezasAluminio.nodo, al)]),
      ...(pl === null
        ? []
        : [lectura(NODOS.piezasOtras.plc, NODOS.piezasOtras.nodo, pl)]),
    ])

  it('la primera consulta solo toma la referencia', () => {
    expect(piezasNuevas(null, con(52, 250))).toEqual({
      contadores: { al: 52, pl: 250 },
      nuevas: [],
    })
  })

  it('lo que suba cada contador son piezas de ese material', () => {
    const { contadores, nuevas } = piezasNuevas(
      { al: 52, pl: 250 },
      con(54, 251),
    )
    expect(contadores).toEqual({ al: 54, pl: 251 })
    expect(nuevas).toEqual(['al', 'al', 'pl'])
  })

  it('si un contador baja se reinició: no inventa piezas', () => {
    expect(piezasNuevas({ al: 52, pl: 250 }, con(0, 251)).nuevas).toEqual([
      'pl',
    ])
  })

  it('después de mucho tiempo sin consultar solo mete las últimas', () => {
    expect(piezasNuevas({ al: 0, pl: 0 }, con(40, 0)).nuevas).toHaveLength(
      MAXIMO_POR_CONSULTA,
    )
  })

  it('sin contadores no cambia nada', () => {
    expect(piezasNuevas({ al: 1, pl: 1 }, con(null, null))).toEqual({
      contadores: { al: 1, pl: 1 },
      nuevas: [],
    })
  })
})
