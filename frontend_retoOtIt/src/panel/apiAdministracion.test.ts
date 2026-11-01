import { afterEach, describe, expect, it, vi } from 'vitest'
import { decidirCuenta, listarCuentas } from './apiAdministracion'

function responder(estado: number, cuerpo?: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      status: estado,
      json: async () => cuerpo,
    }),
  )
}

const cuenta = {
  id: 5,
  nombre: 'Ana Lopez',
  correo: 'ana@ejemplo.com',
  rol: 'usuario',
  estado: 'pendiente',
  creadoEn: '2026-10-30T15:00:00.000Z',
}

afterEach(() => vi.unstubAllGlobals())

describe('listarCuentas', () => {
  it('pide la lista con el estado en la direccion', async () => {
    responder(200, { usuarios: [cuenta] })
    const resultado = await listarCuentas('pendiente')
    expect(resultado).toEqual({ ok: true, cuentas: [cuenta] })
    expect(fetch).toHaveBeenCalledWith(
      '/api/panel/administracion/usuarios?estado=pendiente',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it.each([401, 403])('el %s se toma como sesion caducada', async (codigo) => {
    responder(codigo, { error: 'x' })
    expect(await listarCuentas('pendiente')).toEqual({
      ok: false,
      motivo: 'sesion',
    })
  })

  it('falla si la respuesta no tiene la forma esperada', async () => {
    responder(200, { usuarios: [{ id: 'cinco' }] })
    expect(await listarCuentas('pendiente')).toEqual({
      ok: false,
      motivo: 'fallo',
    })
  })

  it('falla si el servidor da error o no hay red', async () => {
    responder(500, { error: 'x' })
    expect(await listarCuentas('pendiente')).toEqual({
      ok: false,
      motivo: 'fallo',
    })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('red')))
    expect(await listarCuentas('pendiente')).toEqual({
      ok: false,
      motivo: 'fallo',
    })
  })
})

describe('decidirCuenta', () => {
  it('manda la decision a la cuenta', async () => {
    responder(200, { mensaje: 'Cuenta aprobada' })
    expect(await decidirCuenta(5, 'aprobado')).toEqual({ ok: true })
    expect(fetch).toHaveBeenCalledWith(
      '/api/panel/administracion/usuarios/5/decision',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ decision: 'aprobado' }),
      }),
    )
  })

  it.each([
    [401, 'sesion'],
    [403, 'no_permitido'],
    [404, 'no_existe'],
    [409, 'sin_cambio'],
    [500, 'fallo'],
  ] as const)('el codigo %s es %s', async (codigo, motivo) => {
    responder(codigo, { error: 'x' })
    expect(await decidirCuenta(5, 'rechazado')).toEqual({
      ok: false,
      motivo,
    })
  })

  it('falla si no hay red', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('red')))
    expect(await decidirCuenta(5, 'aprobado')).toEqual({
      ok: false,
      motivo: 'fallo',
    })
  })
})
