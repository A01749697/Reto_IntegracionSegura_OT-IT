import { describe, expect, it, vi } from 'vitest'
import type { Pool } from 'pg'
import {
  CATALOGO,
  TABLAS_DATOS,
  crearPatron,
  leerTabla,
} from './datos.repositorio'

describe('catálogo de Datos', () => {
  it('tiene una entrada por cada tabla permitida', () => {
    expect(Object.keys(CATALOGO).sort()).toEqual([...TABLAS_DATOS].sort())
  })

  it('ninguna tabla deja ver contraseñas, huellas ni llaves', () => {
    for (const tabla of TABLAS_DATOS) {
      for (const { clave, titulo } of CATALOGO[tabla].columnas) {
        expect(`${clave} ${titulo}`).not.toMatch(/contrasena|hash|token|clave/i)
      }
    }
  })

  it('el id va primero en todas', () => {
    for (const tabla of TABLAS_DATOS) {
      expect(CATALOGO[tabla].columnas[0]?.clave).toBe('id')
    }
  })
})

describe('crearPatron', () => {
  it('sin texto no hay patrón', () => {
    expect(crearPatron(null)).toBeNull()
  })

  it('busca el texto en cualquier parte', () => {
    expect(crearPatron('ana')).toBe('%ana%')
  })

  it('los comodines escritos se buscan tal cual', () => {
    expect(crearPatron('100%')).toBe('%100\\%%')
    expect(crearPatron('a_b')).toBe('%a\\_b%')
    expect(crearPatron('a\\b')).toBe('%a\\\\b%')
  })
})

describe('leerTabla', () => {
  function poolFalso(filas: unknown[]) {
    const query = vi.fn().mockResolvedValue({ rows: filas })
    return { pool: { query } as unknown as Pool, query }
  }

  it('cuentas: nunca pide la huella de la contraseña y pasa los ids a número', async () => {
    const { pool, query } = poolFalso([
      {
        id: '7',
        nombre: 'Ana',
        correo: 'ana@ejemplo.com',
        rol: 'usuario',
        estado: 'aprobado',
        intentos_fallidos: 0,
        bloqueado_hasta: null,
        creado_en: new Date('2026-11-01T10:00:00Z'),
        aprobado_en: null,
        aprobado_por: '1',
      },
    ])

    const filas = await leerTabla(pool, 'cuentas', {
      buscar: 'ana',
      antes: 9,
      limite: 51,
    })

    const [sql, parametros] = query.mock.calls[0] ?? []
    expect(sql).not.toMatch(/contrasena_hash|SELECT \*/i)
    expect(parametros).toEqual([9, '%ana%', 51])
    expect(filas[0]).toMatchObject({ id: 7, aprobadoPor: 1, aprobadoEn: null })
    expect(Object.keys(filas[0] ?? {})).toEqual(
      CATALOGO.cuentas.columnas.map((c) => c.clave),
    )
  })

  it('bitácora: las filas traen justo las columnas del catálogo', async () => {
    const { pool, query } = poolFalso([
      {
        id: '30',
        ocurrio_en: new Date('2026-11-07T12:00:00Z'),
        tipo: 'entrada_fallida',
        usuario_id: null,
        actor_id: '2',
        correo: 'x@ejemplo.com',
        ip: '203.0.113.7',
      },
    ])

    const filas = await leerTabla(pool, 'bitacora', {
      buscar: null,
      antes: null,
      limite: 11,
    })

    expect(query.mock.calls[0]?.[1]).toEqual([null, null, 11])
    expect(filas[0]).toMatchObject({ id: 30, usuarioId: null, actorId: 2 })
    expect(Object.keys(filas[0] ?? {})).toEqual(
      CATALOGO.bitacora.columnas.map((c) => c.clave),
    )
  })
})
