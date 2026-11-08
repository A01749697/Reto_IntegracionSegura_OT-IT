import { afterEach, describe, expect, it, vi } from 'vitest'
import { aplicarTema, temaActual } from './tema'

afterEach(() => {
  delete document.documentElement.dataset.tema
  localStorage.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('temaActual', () => {
  it('usa el que ya puso el script de la pagina', () => {
    document.documentElement.dataset.tema = 'claro'
    expect(temaActual()).toBe('claro')
  })

  it('si no hay nada, usa el que se guardo', () => {
    localStorage.setItem('tema', 'claro')
    expect(temaActual()).toBe('claro')
  })

  it('ignora un valor guardado que no conoce', () => {
    localStorage.setItem('tema', 'verde')
    expect(temaActual()).toBe('oscuro')
  })

  it('sin eleccion sigue al sistema', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    expect(temaActual()).toBe('claro')
  })

  it('sin eleccion ni sistema que opine, queda oscuro', () => {
    expect(temaActual()).toBe('oscuro')
  })

  it('no falla si el almacenamiento no se puede leer', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    expect(temaActual()).toBe('oscuro')
  })
})

describe('aplicarTema', () => {
  it('lo pone en la pagina y lo guarda', () => {
    aplicarTema('claro')
    expect(document.documentElement.dataset.tema).toBe('claro')
    expect(localStorage.getItem('tema')).toBe('claro')
  })

  it('aunque no se pueda guardar, igual lo pone', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    aplicarTema('claro')
    expect(document.documentElement.dataset.tema).toBe('claro')
  })
})
