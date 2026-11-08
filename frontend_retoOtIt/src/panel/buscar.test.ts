import { describe, expect, it } from 'vitest'
import { coincide, normalizar } from './buscar'

describe('normalizar', () => {
  it('quita acentos y pasa a minusculas', () => {
    expect(normalizar('Tomás BELTRÁN')).toBe('tomas beltran')
  })
})

describe('coincide', () => {
  it('encuentra una parte del nombre sin importar acentos ni mayusculas', () => {
    expect(coincide('Tomás Beltrán', 'tomas')).toBe(true)
    expect(coincide('Tomás Beltrán', 'BELTR')).toBe(true)
  })

  it('no encuentra lo que no esta', () => {
    expect(coincide('Ana Lugo', 'marina')).toBe(false)
  })

  it('ignora los espacios de los extremos', () => {
    expect(coincide('Ana Lugo', '  ana ')).toBe(true)
  })

  it('una busqueda vacia coincide con todo', () => {
    expect(coincide('Ana Lugo', '')).toBe(true)
    expect(coincide('Ana Lugo', '   ')).toBe(true)
  })
})
