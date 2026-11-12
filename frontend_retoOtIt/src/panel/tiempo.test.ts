import { describe, expect, it } from 'vitest'
import i18n from '../idioma/i18n'
import { fechaCorta, fechaHora, hace } from './tiempo'

describe('hace', () => {
  it.each([
    [0, 'hace 0 s'],
    [59, 'hace 59 s'],
    [60, 'hace 1 min'],
    [3599, 'hace 59 min'],
    [3600, 'hace 1 h'],
    [86399, 'hace 23 h'],
    [86400, 'hace 1 d'],
    [3 * 86400 + 500, 'hace 3 d'],
  ])('%i segundos se lee "%s"', (segundos, texto) => {
    expect(hace(segundos)).toBe(texto)
  })
})

describe('fechaHora', () => {
  it('escribe el año y la hora', () => {
    const texto = fechaHora('2026-11-06T18:30:05Z')
    expect(texto).toMatch(/2026/)
    expect(texto).toMatch(/\d{1,2}:\d{2}:\d{2}/)
  })
})

describe('tiempo en inglés', () => {
  it('escribe el tiempo pasado y la fecha a la manera inglesa', async () => {
    await i18n.changeLanguage('en')
    expect(hace(59)).toBe('59 s ago')
    expect(hace(3600)).toBe('1 h ago')
    expect(fechaHora('2026-11-06T18:30:05Z')).toMatch(/Nov/)
    expect(fechaCorta('2026-11-06T18:30:05Z')).toMatch(/Nov \d{1,2}, 2026/)
  })

  it('en español la fecha corta lleva el mes en español', () => {
    expect(fechaCorta('2026-11-06T18:30:05Z')).toMatch(/nov/)
  })
})
