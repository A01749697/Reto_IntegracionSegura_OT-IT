import { describe, expect, it } from 'vitest'
import { bytes, porcentaje } from './formato'

describe('bytes', () => {
  it('escoge la unidad que corresponde', () => {
    expect(bytes(0)).toBe('0 B')
    expect(bytes(512)).toBe('512 B')
    expect(bytes(1024)).toBe('1 KB')
    expect(bytes(5 * 1024 * 1024)).toBe('5 MB')
    expect(bytes(1.5 * 1024 * 1024 * 1024)).toBe('1.5 GB')
  })

  it('un valor negativo se trata como cero', () => {
    expect(bytes(-5)).toBe('0 B')
  })
})

describe('porcentaje', () => {
  it('redondea y se queda entre 0 y 100', () => {
    expect(porcentaje(1, 3)).toBe(33)
    expect(porcentaje(5, 4)).toBe(100)
    expect(porcentaje(-1, 4)).toBe(0)
  })

  it('con total cero regresa 0', () => {
    expect(porcentaje(10, 0)).toBe(0)
  })
})
