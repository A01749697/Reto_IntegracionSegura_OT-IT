import { afterEach, describe, expect, it, vi } from 'vitest'
import { descargarArchivo } from './descarga'

afterEach(() => vi.restoreAllMocks())

describe('descargarArchivo', () => {
  it('crea un enlace con el nombre, lo pulsa y limpia', () => {
    const crear = vi.fn().mockReturnValue('blob:prueba')
    const revocar = vi.fn()
    Object.assign(URL, { createObjectURL: crear, revokeObjectURL: revocar })
    const pulsar = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe('archivo.csv')
        expect(this.href).toBe('blob:prueba')
      })
    const archivo = new Blob(['x'])

    descargarArchivo('archivo.csv', archivo)

    expect(crear).toHaveBeenCalledWith(archivo)
    expect(pulsar).toHaveBeenCalledTimes(1)
    expect(revocar).toHaveBeenCalledWith('blob:prueba')
    expect(document.querySelector('a[download]')).toBeNull()
  })
})
