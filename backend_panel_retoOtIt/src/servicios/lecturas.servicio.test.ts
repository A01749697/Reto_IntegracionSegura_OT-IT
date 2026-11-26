import { describe, expect, it, vi } from 'vitest'
import { seguridad } from '../configuracion/seguridad'
import { crearServicioLecturas } from './lecturas.servicio'

const consultaValida = {
  plc: 'S7-1500',
  variable: 'contador_piezas',
  desde: '2026-10-28T16:00:00Z',
  hasta: '2026-10-28T17:00:00Z',
}

function crearDependenciasFalsas() {
  return {
    obtenerUltimasLecturas: vi.fn().mockResolvedValue([]),
    obtenerHistorial: vi
      .fn()
      .mockResolvedValue({ puntos: [], truncado: false }),
    obtenerSerie: vi.fn().mockResolvedValue({ puntos: [], truncado: false }),
    ahora: () => Date.parse('2026-11-25T06:00:00Z'),
  }
}

describe('servicio de lecturas del panel', () => {
  it('ultimas devuelve lo que entrega la base', async () => {
    const dependencias = crearDependenciasFalsas()
    const ultimas = [
      {
        plc: 'S7-1500',
        variable: 'contador_piezas',
        valor: 42,
        ts: new Date('2026-10-28T16:00:00Z'),
      },
    ]
    dependencias.obtenerUltimasLecturas.mockResolvedValue(ultimas)
    const servicio = crearServicioLecturas(dependencias)

    expect(await servicio.ultimas()).toEqual(ultimas)
  })

  it('historial con filtros válidos consulta con fechas reales y el tope de puntos', async () => {
    const dependencias = crearDependenciasFalsas()
    const puntos = [{ ts: new Date('2026-10-28T16:30:00Z'), valor: 7 }]
    dependencias.obtenerHistorial.mockResolvedValue({ puntos, truncado: false })
    const servicio = crearServicioLecturas(dependencias)

    const resultado = await servicio.historial(consultaValida)

    expect(resultado).toEqual({ ok: true, puntos, truncado: false })
    expect(dependencias.obtenerHistorial).toHaveBeenCalledWith({
      plc: 'S7-1500',
      variable: 'contador_piezas',
      desde: new Date('2026-10-28T16:00:00Z'),
      hasta: new Date('2026-10-28T17:00:00Z'),
      limite: seguridad.lecturas.maximoPuntosHistorial,
    })
  })

  it('historial avisa cuando la respuesta fue recortada por el tope', async () => {
    const dependencias = crearDependenciasFalsas()
    dependencias.obtenerHistorial.mockResolvedValue({
      puntos: [],
      truncado: true,
    })
    const servicio = crearServicioLecturas(dependencias)

    expect(await servicio.historial(consultaValida)).toMatchObject({
      ok: true,
      truncado: true,
    })
  })

  it('historial con filtros inválidos devuelve el error sin consultar la base', async () => {
    const dependencias = crearDependenciasFalsas()
    const servicio = crearServicioLecturas(dependencias)

    const resultado = await servicio.historial({
      ...consultaValida,
      plc: "S7';--",
    })

    expect(resultado).toMatchObject({
      ok: false,
      error: expect.stringContaining('plc'),
    })
    expect(dependencias.obtenerHistorial).not.toHaveBeenCalled()
  })

  it('si la base falla, el error sube', async () => {
    const dependencias = crearDependenciasFalsas()
    dependencias.obtenerHistorial.mockRejectedValue(new Error('base caída'))
    const servicio = crearServicioLecturas(dependencias)

    await expect(servicio.historial(consultaValida)).rejects.toThrow(
      'base caída',
    )
  })
})

describe('indicadores', () => {
  const consulta = {
    desde: '2026-11-24T06:00:00Z',
    hasta: '2026-11-25T06:00:00Z',
    cubeta: 'hora',
  }

  it('lee los cinco nodos del S7-1516 y entrega un tramo por hora', async () => {
    const dependencias = crearDependenciasFalsas()
    dependencias.obtenerSerie.mockImplementation(
      async (_plc: string, nodo: string) => ({
        puntos:
          nodo === 'TAB_ALUMINIO'
            ? [
                { ts: new Date('2026-11-24T05:00:00Z'), valor: 10 },
                { ts: new Date('2026-11-24T06:30:00Z'), valor: 12 },
              ]
            : [],
        truncado: nodo === 'TAB_PASO',
      }),
    )
    const servicio = crearServicioLecturas(dependencias)
    const resultado = await servicio.indicadores(consulta)
    if (!resultado.ok) throw new Error(resultado.error)
    expect(resultado.cubetas).toHaveLength(24)
    expect(resultado.cubetas[0]?.aluminio).toBe(2)
    expect(resultado.truncado).toBe(true)
    const nodos = dependencias.obtenerSerie.mock.calls.map((c) => c[1])
    expect(nodos.sort()).toEqual(
      ['LATIDO', 'TAB_ALUMINIO', 'TAB_OTRAS', 'TAB_PASO', 'TAB_TORRETA'].sort(),
    )
    expect(dependencias.obtenerSerie).toHaveBeenCalledWith(
      'S7-1500',
      'TAB_PASO',
      new Date(consulta.desde),
      new Date(consulta.hasta),
      seguridad.lecturas.maximoPuntosIndicadores,
    )
  })

  it('con una consulta inválida no toca la base', async () => {
    const dependencias = crearDependenciasFalsas()
    const servicio = crearServicioLecturas(dependencias)
    const resultado = await servicio.indicadores({ ...consulta, cubeta: 'x' })
    expect(resultado.ok).toBe(false)
    expect(dependencias.obtenerSerie).not.toHaveBeenCalled()
  })
})
