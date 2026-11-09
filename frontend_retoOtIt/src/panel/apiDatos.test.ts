import { afterEach, describe, expect, it, vi } from 'vitest'
import { leerDatos, listarTablas } from './apiDatos'

function responder(estado: number, cuerpo?: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ status: estado, json: async () => cuerpo }),
  )
}

const columnas = [
  { clave: 'id', titulo: 'id' },
  { clave: 'correo', titulo: 'correo' },
]
const pagina = {
  columnas,
  filas: [{ id: 3, correo: 'ana@ejemplo.com' }],
  hayMas: true,
}

afterEach(() => vi.unstubAllGlobals())

describe('listarTablas', () => {
  it('entrega solo el id y el nombre de cada tabla', async () => {
    responder(200, {
      tablas: [{ id: 'cuentas', nombre: 'Cuentas', columnas }],
    })
    expect(await listarTablas()).toEqual({
      ok: true,
      tablas: [{ id: 'cuentas', nombre: 'Cuentas' }],
    })
    expect(fetch).toHaveBeenCalledWith(
      '/api/panel/administracion/datos',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it.each([401, 403])('el %s se toma como sesión caducada', async (codigo) => {
    responder(codigo, { error: 'x' })
    expect(await listarTablas()).toEqual({ ok: false, motivo: 'sesion' })
  })

  it('una respuesta con otra forma cuenta como fallo', async () => {
    responder(200, { tablas: [{ id: 1 }] })
    expect(await listarTablas()).toEqual({ ok: false, motivo: 'fallo' })
  })

  it('si la red falla, es un fallo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin red')))
    expect(await listarTablas()).toEqual({ ok: false, motivo: 'fallo' })
  })
})

describe('leerDatos', () => {
  it('pide la tabla sin filtros', async () => {
    responder(200, pagina)
    expect(await leerDatos('cuentas', '')).toEqual({ ok: true, ...pagina })
    expect(fetch).toHaveBeenCalledWith(
      '/api/panel/administracion/datos/cuentas',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('con buscar y antes los manda bien escritos', async () => {
    responder(200, pagina)
    await leerDatos('bitacora', 'ana lópez&x=1', 40)
    expect(fetch).toHaveBeenCalledWith(
      '/api/panel/administracion/datos/bitacora?buscar=ana+l%C3%B3pez%26x%3D1&antes=40',
      expect.anything(),
    )
  })

  it('acepta celdas vacías, números, textos y booleanos', async () => {
    responder(200, {
      columnas,
      filas: [{ id: 1, correo: null, activo: true }],
      hayMas: false,
    })
    expect((await leerDatos('cuentas', '')).ok).toBe(true)
  })

  it.each([401, 403])('el %s se toma como sesión caducada', async (codigo) => {
    responder(codigo, { error: 'x' })
    expect(await leerDatos('cuentas', '')).toEqual({
      ok: false,
      motivo: 'sesion',
    })
  })

  it.each([
    ['sin filas', { columnas, hayMas: false }],
    ['con una fila que no es objeto', { columnas, filas: [5], hayMas: false }],
    [
      'con una celda que es un objeto',
      { columnas, filas: [{ id: { a: 1 } }], hayMas: false },
    ],
    ['sin hayMas', { columnas, filas: [] }],
    [
      'con columnas mal formadas',
      { columnas: [{ clave: 1 }], filas: [], hayMas: false },
    ],
  ])('una respuesta %s cuenta como fallo', async (_nombre, cuerpo) => {
    responder(200, cuerpo)
    expect(await leerDatos('cuentas', '')).toEqual({
      ok: false,
      motivo: 'fallo',
    })
  })

  it('un 404 o un 500 son un fallo', async () => {
    responder(404, { error: 'La tabla no existe' })
    expect(await leerDatos('otra', '')).toEqual({ ok: false, motivo: 'fallo' })
  })
})
