import { describe, expect, it } from 'vitest'
import { estadoEnlace, resumirLecturas, SEGUNDOS_ATRASO } from './enVivo'

const lectura = (plc: string, variable: string, valor: number, ts: string) => ({
  plc,
  variable,
  valor,
  ts,
})

describe('resumirLecturas', () => {
  const lecturas = [
    lectura('S7-1500', 'TAB_TORRETA', 1, '2026-11-26T20:00:02.000Z'),
    lectura('S7-1500', 'LATIDO', 40, '2026-11-26T20:00:05.000Z'),
    lectura('S7-300', 'CONTADOR', 3, '2026-11-26T20:00:09.000Z'),
    lectura('S7-9999', 'OTRO', 1, '2026-11-26T20:00:10.000Z'),
    lectura('S7-1500', 'MALA', 1, 'no es fecha'),
  ]

  it('agrupa por estación, en orden de nombre, e ignora lo que no es de la celda', () => {
    const r = resumirLecturas(lecturas)
    expect(r.estaciones['S7-1500'].map((n) => n.nodo)).toEqual([
      'LATIDO',
      'TAB_TORRETA',
    ])
    expect(r.estaciones['S7-300']).toHaveLength(1)
    expect(r.ultima).toBe('2026-11-26T20:00:09.000Z')
  })

  it('separa los valores del S7-1516 para arrancar el gemelo', () => {
    const r = resumirLecturas(lecturas)
    expect(r.tablero).toEqual({ TAB_TORRETA: 1, LATIDO: 40 })
    expect(r.ultimaTablero).toBe(Date.parse('2026-11-26T20:00:05.000Z'))
  })
})

describe('estadoEnlace', () => {
  it('en vivo, atrasado o sin lecturas', () => {
    const r = resumirLecturas([
      lectura('S7-1500', 'LATIDO', 1, '2026-11-26T20:00:00.000Z'),
    ])
    const t = Date.parse('2026-11-26T20:00:00.000Z')
    expect(estadoEnlace(r, t + 1000)).toBe('en_vivo')
    expect(estadoEnlace(r, t + (SEGUNDOS_ATRASO + 1) * 1000)).toBe('atrasado')
    expect(estadoEnlace(resumirLecturas([]), t)).toBe('sin_lecturas')
  })
})
