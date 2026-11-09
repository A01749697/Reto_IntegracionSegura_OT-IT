import { describe, expect, it } from 'vitest'
import { iniciales } from './iniciales'

describe('iniciales', () => {
  it('toma la primera letra de las dos primeras palabras', () => {
    expect(iniciales('Ana Lugo')).toBe('AL')
    expect(iniciales('Eduardo Serrano Corona')).toBe('ES')
  })

  it('con una sola palabra da una letra y la pone en mayúscula', () => {
    expect(iniciales('marina')).toBe('M')
  })

  it('ignora los espacios de sobra', () => {
    expect(iniciales('  Iván   Cortés ')).toBe('IC')
  })

  it('un nombre vacío no da nada', () => {
    expect(iniciales('   ')).toBe('')
  })
})
