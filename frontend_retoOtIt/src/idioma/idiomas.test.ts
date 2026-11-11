import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  esIdioma,
  guardarIdioma,
  idiomaDelNavegador,
  idiomaGuardado,
  idiomaInicial,
} from './idiomas'

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

const navegadorEn = (lista: string[]) =>
  vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(lista)

describe('idiomas', () => {
  it('solo acepta español e inglés', () => {
    expect(esIdioma('es')).toBe(true)
    expect(esIdioma('en')).toBe(true)
    expect(esIdioma('fr')).toBe(false)
    expect(esIdioma(null)).toBe(false)
  })

  it('guarda y lee lo que se eligió', () => {
    guardarIdioma('en')
    expect(localStorage.getItem('idioma')).toBe('en')
    expect(idiomaGuardado()).toBe('en')
  })

  it('ignora un valor guardado que no es un idioma', () => {
    localStorage.setItem('idioma', 'klingon')
    expect(idiomaGuardado()).toBeNull()
  })

  it('si el almacenamiento falla, no se rompe', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    expect(idiomaGuardado()).toBeNull()
    expect(() => guardarIdioma('en')).not.toThrow()
  })

  it('toma el primer idioma del navegador que conoce', () => {
    navegadorEn(['fr-FR', 'en-US', 'es-MX'])
    expect(idiomaDelNavegador()).toBe('en')
  })

  it('con un navegador en otro idioma no adivina', () => {
    navegadorEn(['fr-FR', 'de'])
    expect(idiomaDelNavegador()).toBeNull()
  })

  it('al abrir manda lo guardado, luego el navegador y al final español', () => {
    navegadorEn(['en-US'])
    expect(idiomaInicial()).toBe('en')
    guardarIdioma('es')
    expect(idiomaInicial()).toBe('es')
    localStorage.clear()
    navegadorEn(['fr-FR'])
    expect(idiomaInicial()).toBe('es')
  })
})
