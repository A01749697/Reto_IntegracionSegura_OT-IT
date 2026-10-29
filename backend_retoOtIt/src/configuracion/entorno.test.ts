import { describe, expect, it } from 'vitest'
import { leerEntorno } from './entorno'

const base = {
  API_INGEST_TOKEN: 'a'.repeat(64),
  DB_INGEST_PASSWORD: 'contrasena_de_prueba_123',
}

describe('leerEntorno', () => {
  it('lee los valores y usa los valores por defecto que no son secretos', () => {
    const entorno = leerEntorno(base)
    expect(entorno.puerto).toBe(3001)
    expect(entorno.tokenIngesta).toBe(base.API_INGEST_TOKEN)
    expect(entorno.baseDatos).toEqual({
      host: 'db',
      puerto: 5432,
      usuario: 'reto_insercion',
      contrasena: base.DB_INGEST_PASSWORD,
      nombre: 'reto',
    })
  })

  it('no arranca si falta el token', () => {
    expect(() => leerEntorno({ DB_INGEST_PASSWORD: 'x' })).toThrow(
      'API_INGEST_TOKEN',
    )
  })

  it('no arranca si el token es demasiado corto', () => {
    expect(() => leerEntorno({ ...base, API_INGEST_TOKEN: 'corto' })).toThrow(
      'al menos 32',
    )
  })

  it('no arranca si falta la contraseña de la base de datos', () => {
    expect(() =>
      leerEntorno({ API_INGEST_TOKEN: base.API_INGEST_TOKEN }),
    ).toThrow('DB_INGEST_PASSWORD')
  })

  it('no arranca si el puerto no es válido', () => {
    expect(() => leerEntorno({ ...base, PUERTO: 'abc' })).toThrow('PUERTO')
    expect(() => leerEntorno({ ...base, PUERTO: '70000' })).toThrow('PUERTO')
  })

  it('acepta un puerto y un host propios', () => {
    const entorno = leerEntorno({
      ...base,
      PUERTO: '4000',
      DB_HOST: 'localhost',
    })
    expect(entorno.puerto).toBe(4000)
    expect(entorno.baseDatos.host).toBe('localhost')
  })
})
