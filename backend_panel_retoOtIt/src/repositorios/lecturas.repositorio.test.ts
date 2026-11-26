import { describe, expect, it, vi } from 'vitest'
import type { Pool } from 'pg'
import {
  obtenerActividadLecturas,
  obtenerHistorial,
  obtenerSerie,
  obtenerUltimasLecturas,
  valorNumerico,
} from './lecturas.repositorio'

describe('valorNumerico', () => {
  it.each([
    ['True', 1],
    ['false', 0],
    ['4', 4],
    ['0.0', 0],
    ['-1.5e-3', -0.0015],
    [' 7 ', 7],
  ])('convierte %s en %s', (texto, numero) => {
    expect(valorNumerico(texto)).toBe(numero)
  })

  it.each(['', 'abc', 'NaN', 'Infinity'])('no convierte %s', (texto) => {
    expect(valorNumerico(texto)).toBeNull()
  })
})

describe('obtenerUltimasLecturas', () => {
  it('consulta las tres tablas y entrega plc, nodo y valor numérico', async () => {
    const ts = new Date('2026-11-12T12:00:00.000Z')
    const query = vi.fn(async (texto: string) => ({
      rows: texto.includes('telemetria_1500')
        ? [
            { nodo: 'TAB_PISTON_A', valor: 'True', ts_plc: ts, segundos: '3' },
            { nodo: 'TAB_TEXTO', valor: 'hola', ts_plc: ts, segundos: '3' },
          ]
        : [],
    }))
    const lecturas = await obtenerUltimasLecturas({
      query,
    } as unknown as Pool)

    expect(query).toHaveBeenCalledTimes(3)
    expect(lecturas).toEqual([
      { plc: 'S7-1500', variable: 'TAB_PISTON_A', valor: 1, ts },
    ])
  })
})

describe('obtenerHistorial', () => {
  it('usa la tabla de la estación y pasa los filtros como parámetros', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        { ts: new Date('2026-11-12T12:00:02Z'), valor: '5' },
        { ts: new Date('2026-11-12T12:00:01Z'), valor: 'False' },
      ],
    })
    const historial = await obtenerHistorial({ query } as unknown as Pool, {
      plc: 'S7-300',
      variable: 'CONTADOR',
      desde: new Date('2026-11-12T11:00:00Z'),
      hasta: new Date('2026-11-12T13:00:00Z'),
      limite: 10,
    })
    const [texto, parametros] = query.mock.calls[0]
    expect(texto).toContain('FROM telemetria_300')
    expect(texto).not.toContain('CONTADOR')
    expect(parametros[0]).toBe('CONTADOR')
    expect(historial).toEqual({
      truncado: false,
      puntos: [
        { ts: new Date('2026-11-12T12:00:01Z'), valor: 0 },
        { ts: new Date('2026-11-12T12:00:02Z'), valor: 5 },
      ],
    })
  })
})

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

describe('obtenerSerie', () => {
  const desde = new Date('2026-11-24T06:00:00Z')
  const hasta = new Date('2026-11-25T06:00:00Z')

  it('trae el último valor de antes y los de la ventana, en orden y como número', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        { ts: new Date('2026-11-23T20:00:00Z'), valor: '5', antes: true },
        { ts: new Date('2026-11-24T07:00:00Z'), valor: '6', antes: false },
        { ts: new Date('2026-11-24T08:00:00Z'), valor: 'hola', antes: false },
      ],
    })
    const serie = await obtenerSerie(
      { query } as unknown as Pool,
      'S7-1500',
      'TAB_ALUMINIO',
      desde,
      hasta,
      10,
    )
    expect(serie.puntos.map((p) => p.valor)).toEqual([5, 6])
    expect(serie.truncado).toBe(false)
    const [texto, parametros] = query.mock.calls[0] as [string, unknown[]]
    expect(texto).toContain('telemetria_1500')
    expect(texto).not.toContain('TAB_ALUMINIO')
    expect(parametros).toEqual([
      'TAB_ALUMINIO',
      desde.toISOString(),
      hasta.toISOString(),
      10,
    ])
  })

  it('avisa si llegó al tope', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        { ts: new Date('2026-11-24T07:00:00Z'), valor: '1', antes: false },
        { ts: new Date('2026-11-24T07:01:00Z'), valor: '2', antes: false },
      ],
    })
    const serie = await obtenerSerie(
      { query } as unknown as Pool,
      'S7-1500',
      'TAB_PASO',
      desde,
      hasta,
      2,
    )
    expect(serie.truncado).toBe(true)
  })
})
