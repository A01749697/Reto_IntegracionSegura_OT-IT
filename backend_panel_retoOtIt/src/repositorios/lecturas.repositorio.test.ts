import { describe, expect, it, vi } from 'vitest'
import type { Pool } from 'pg'
import { obtenerActividadLecturas } from './lecturas.repositorio'

describe('obtenerActividadLecturas', () => {
  it('pide la hora de la base y después cuenta por tramos con esa misma hora', async () => {
    const ahora = new Date('2026-11-12T12:07:00.000Z')
    const primera = new Date('2026-11-06T18:00:00.000Z')
    const cubetas = [
      { inicio: new Date('2026-11-12T12:00:00.000Z'), lecturas: 7 },
    ]
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ ahora, primera }] })
      .mockResolvedValueOnce({ rows: cubetas })
    const pool = { query } as unknown as Pool

    const actividad = await obtenerActividadLecturas(pool, 900, 96)

    expect(actividad).toEqual({ ahora, primera, cubetas })
    expect(query).toHaveBeenCalledTimes(2)
    expect(query.mock.calls[1][1]).toEqual([900, 96, ahora.toISOString()])
  })

  it('no mete ningún valor dentro del texto de la consulta', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [{ ahora: new Date(), primera: null }],
      })
      .mockResolvedValueOnce({ rows: [] })
    await obtenerActividadLecturas({ query } as unknown as Pool, 7200, 84)

    const texto = query.mock.calls[1][0] as string
    expect(texto).toContain('$1')
    expect(texto).toContain('$2')
    expect(texto).toContain('$3')
    expect(texto).not.toContain('7200')
  })

  it('sin lecturas la primera es null', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [{ ahora: new Date(), primera: null }],
      })
      .mockResolvedValueOnce({ rows: [] })
    const actividad = await obtenerActividadLecturas(
      { query } as unknown as Pool,
      900,
      96,
    )
    expect(actividad.primera).toBeNull()
    expect(actividad.cubetas).toEqual([])
  })
})
