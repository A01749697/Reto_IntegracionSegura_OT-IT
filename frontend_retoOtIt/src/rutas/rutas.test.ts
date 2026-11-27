import { describe, expect, it } from 'vitest'
import {
  destinoDeSeccion,
  direccionDe,
  leerDestino,
  RAIZ,
  type Destino,
} from './rutas'

const en = (hash: string, pathname = '/') => leerDestino({ pathname, hash })

describe('rutas', () => {
  it('sin nada después de la dirección es la raíz', () => {
    expect(en('')).toEqual(RAIZ)
    expect(en('#')).toEqual(RAIZ)
    expect(en('#/')).toEqual(RAIZ)
    expect(en('', '/index.html')).toEqual(RAIZ)
  })

  it.each([
    ['#/entrar', { donde: 'publica', pagina: 'login' }],
    ['#/crear-cuenta', { donde: 'publica', pagina: 'crear' }],
    ['#/cuentas', { donde: 'panel', seccion: 'cuentas' }],
    ['#/bitacora', { donde: 'panel', seccion: 'bitacora' }],
    ['#/datos', { donde: 'panel', seccion: 'datos' }],
    ['#/estado', { donde: 'panel', seccion: 'estado' }],
    ['#/tablero', { donde: 'panel', seccion: 'tablero' }],
    ['#/gemelo', { donde: 'panel', seccion: 'gemelo' }],
    ['#/mi-cuenta', { donde: 'panel', seccion: 'cuenta' }],
    ['#/ayuda', { donde: 'panel', seccion: 'ayuda' }],
  ])(
    '%s lleva a su pantalla y regresa a la misma dirección',
    (hash, destino) => {
      expect(en(hash)).toEqual(destino)
      expect(direccionDe(destino as Destino)).toBe(`/${hash}`)
    },
  )

  it('la dirección vieja de Indicadores lleva al tablero', () => {
    expect(en('#/indicadores')).toEqual({ donde: 'panel', seccion: 'tablero' })
    expect(direccionDe({ donde: 'panel', seccion: 'tablero' })).toBe(
      '/#/tablero',
    )
  })

  it('acepta una diagonal al final', () => {
    expect(en('#/estado/')).toEqual({ donde: 'panel', seccion: 'estado' })
  })

  it('una pantalla que no existe es desconocida', () => {
    expect(en('#/no-existe')).toEqual({ donde: 'desconocida' })
    expect(en('#/cuentas/7')).toEqual({ donde: 'desconocida' })
  })

  it('no se confunde con nombres internos de JavaScript', () => {
    expect(en('#/constructor')).toEqual({ donde: 'desconocida' })
    expect(en('#/__proto__')).toEqual({ donde: 'desconocida' })
  })

  it('una carpeta que no es la raíz es desconocida', () => {
    expect(en('', '/algo')).toEqual({ donde: 'desconocida' })
    expect(en('#/estado', '/algo')).toEqual({ donde: 'desconocida' })
  })

  it('el enlace del correo no cuenta como pantalla', () => {
    expect(en('#restablecer=abc')).toEqual(RAIZ)
  })

  it('la raíz y lo desconocido se escriben como la dirección base', () => {
    expect(direccionDe(RAIZ)).toBe('/')
    expect(direccionDe({ donde: 'desconocida' })).toBe('/')
  })

  it('cada sección del panel tiene su destino', () => {
    expect(destinoDeSeccion('inicio')).toEqual(RAIZ)
    expect(destinoDeSeccion('cuenta')).toEqual({
      donde: 'panel',
      seccion: 'cuenta',
    })
  })
})
