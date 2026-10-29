import { describe, expect, it } from 'vitest'
import {
  calcularHuellaToken,
  generarToken,
  tieneFormatoDeToken,
} from './tokens'

describe('generarToken', () => {
  it('crea un código de 64 caracteres hexadecimales', () => {
    expect(generarToken()).toMatch(/^[0-9a-f]{64}$/)
  })

  it('no repite códigos', () => {
    const codigos = new Set(Array.from({ length: 100 }, () => generarToken()))
    expect(codigos.size).toBe(100)
  })
})

describe('calcularHuellaToken', () => {
  it('da el resultado conocido de sha256 para "abc"', () => {
    expect(calcularHuellaToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('da siempre lo mismo para el mismo código y es distinta del código', () => {
    const token = generarToken()
    expect(calcularHuellaToken(token)).toBe(calcularHuellaToken(token))
    expect(calcularHuellaToken(token)).not.toBe(token)
  })
})

describe('tieneFormatoDeToken', () => {
  it('acepta un código generado', () => {
    expect(tieneFormatoDeToken(generarToken())).toBe(true)
  })

  it.each([
    '',
    'corto',
    'A'.repeat(64),
    'a'.repeat(63),
    'a'.repeat(65),
    'g'.repeat(64),
  ])('rechaza %j', (texto) => {
    expect(tieneFormatoDeToken(texto)).toBe(false)
  })
})
