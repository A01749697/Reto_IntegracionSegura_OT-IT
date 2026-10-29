import { describe, expect, it } from 'vitest'
import { leerEntorno } from './entorno'

const variablesValidas = {
  URL_PUBLICA: 'https://18.119.219.73',
  CORREO_REMITENTE: 'panel@ejemplo.com',
  DB_READER_PASSWORD: 'clave_lectura_123',
  DB_PANEL_PASSWORD: 'clave_panel_12345',
}

describe('leerEntorno', () => {
  it('usa los valores por defecto', () => {
    const entorno = leerEntorno(variablesValidas)
    expect(entorno.puerto).toBe(3002)
    expect(entorno.regionAws).toBe('us-east-2')
    expect(entorno.urlPublica).toBe('https://18.119.219.73')
    expect(entorno.correoRemitente).toBe('panel@ejemplo.com')
    expect(entorno.baseDatosLectura).toMatchObject({
      host: 'db',
      usuario: 'reto_lectura',
      contrasena: 'clave_lectura_123',
    })
    expect(entorno.baseDatosPanel).toMatchObject({
      host: 'db',
      usuario: 'reto_panel',
      contrasena: 'clave_panel_12345',
    })
  })

  it('respeta PUERTO, DB_HOST y AWS_REGION cuando se indican', () => {
    const entorno = leerEntorno({
      ...variablesValidas,
      PUERTO: '4000',
      DB_HOST: 'otra-base',
      AWS_REGION: 'us-west-2',
    })
    expect(entorno.puerto).toBe(4000)
    expect(entorno.baseDatosLectura.host).toBe('otra-base')
    expect(entorno.baseDatosPanel.host).toBe('otra-base')
    expect(entorno.regionAws).toBe('us-west-2')
  })

  it.each(Object.keys(variablesValidas))(
    'falla si falta %s y dice cuál es',
    (nombre) => {
      const variables: Record<string, string | undefined> = {
        ...variablesValidas,
      }
      delete variables[nombre]
      expect(() => leerEntorno(variables)).toThrow(nombre)
    },
  )

  it('deja solo el origen de URL_PUBLICA', () => {
    const entorno = leerEntorno({
      ...variablesValidas,
      URL_PUBLICA: 'https://ejemplo.com/panel/',
    })
    expect(entorno.urlPublica).toBe('https://ejemplo.com')
  })

  it.each(['http://18.119.219.73', 'no es una url', 'ftp://ejemplo.com'])(
    'rechaza URL_PUBLICA %j',
    (URL_PUBLICA) => {
      expect(() => leerEntorno({ ...variablesValidas, URL_PUBLICA })).toThrow(
        'URL_PUBLICA',
      )
    },
  )

  it.each(['sin-arroba', 'a@b', 'a b@c.com'])(
    'rechaza CORREO_REMITENTE %j',
    (CORREO_REMITENTE) => {
      expect(() =>
        leerEntorno({ ...variablesValidas, CORREO_REMITENTE }),
      ).toThrow('CORREO_REMITENTE')
    },
  )

  it.each(['0', '70000', 'abc', '3.5', ''])('rechaza PUERTO %j', (PUERTO) => {
    expect(() => leerEntorno({ ...variablesValidas, PUERTO })).toThrow('PUERTO')
  })
})
