import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  Disponibilidad,
  EstadoSistema,
  ResultadoDisponibilidad,
  ResultadoEstado,
} from './apiSistema'
import PaginaEstado from './PaginaEstado'

const estadoBase: EstadoSistema = {
  api: 'ok',
  baseDatosPanel: 'ok',
  baseDatosLecturas: 'ok',
  datos: 'al_dia',
  variables: [
    {
      plc: 'S7-1500',
      variable: 'contador_piezas',
      ts: '2026-11-06T18:00:00.000Z',
      segundosDesdeRecibida: 12,
    },
    {
      plc: 'S7-1200',
      variable: 'estado_piston',
      ts: '2026-11-06T17:00:00.000Z',
      segundosDesdeRecibida: 3700,
    },
  ],
}

const historialBase: Disponibilidad = {
  ventana: '24h',
  cubetaSegundos: 900,
  hasta: '2026-11-12T12:07:00.000Z',
  cubetas: [
    { inicio: '2026-11-12T11:30:00.000Z', lecturas: 4, estado: 'con_datos' },
    { inicio: '2026-11-12T11:45:00.000Z', lecturas: 0, estado: 'sin_datos' },
    { inicio: '2026-11-12T12:00:00.000Z', lecturas: 0, estado: 'en_curso' },
  ],
  resumen: {
    porcentaje: 50,
    cubetasEvaluadas: 2,
    cubetasConDatos: 1,
    interrupciones: 1,
    mayorCorteSegundos: 900,
  },
  cortes: [
    {
      desde: '2026-11-12T11:45:00.000Z',
      hasta: '2026-11-12T12:07:00.000Z',
      enCurso: true,
    },
  ],
}

function preparar(
  respuesta: ResultadoEstado,
  historial: ResultadoDisponibilidad = {
    ok: true,
    disponibilidad: historialBase,
  },
) {
  const props = {
    obtener: vi.fn().mockResolvedValue(respuesta),
    obtenerDisponibilidad: vi.fn().mockResolvedValue(historial),
    sesionCaducada: vi.fn(),
  }
  render(<PaginaEstado {...props} />)
  return props
}

beforeEach(() => vi.clearAllMocks())

describe('PaginaEstado', () => {
  it('muestra las cuatro tarjetas cuando todo está bien', async () => {
    preparar({ ok: true, estado: estadoBase })
    expect(await screen.findByText('API del panel')).toBeInTheDocument()
    expect(screen.getByText('Base de datos del panel')).toBeInTheDocument()
    expect(screen.getByText('Base de datos de lecturas')).toBeInTheDocument()
    expect(screen.getByText('Llegada de datos')).toBeInTheDocument()
    expect(screen.getAllByText('Responde')).toHaveLength(3)
    expect(screen.getByText('Al día')).toBeInTheDocument()
  })

  it('lista cada variable con hace cuánto llegó', async () => {
    preparar({ ok: true, estado: estadoBase })
    expect(await screen.findByText('contador_piezas')).toBeInTheDocument()
    expect(screen.getByText('hace 12 s')).toBeInTheDocument()
    expect(screen.getByText('estado_piston')).toBeInTheDocument()
    expect(screen.getByText('hace 1 h')).toBeInTheDocument()
  })

  it('sin lecturas explica qué esperar', async () => {
    preparar({
      ok: true,
      estado: { ...estadoBase, datos: 'sin_datos', variables: [] },
    })
    expect(await screen.findByText('Sin lecturas todavía')).toBeInTheDocument()
    expect(
      screen.getByText(/Cuando el agente empiece a mandar datos/),
    ).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it.each([
    ['retrasado', 'Retrasado'],
    ['desconocido', 'No se pudo saber'],
  ] as const)('muestra el estado de datos %s', async (datos, texto) => {
    preparar({ ok: true, estado: { ...estadoBase, datos } })
    expect(await screen.findByText(texto)).toBeInTheDocument()
  })

  it('dice cuál base de datos no responde', async () => {
    preparar({
      ok: true,
      estado: {
        ...estadoBase,
        baseDatosPanel: 'falla',
        baseDatosLecturas: 'falla',
      },
    })
    expect(await screen.findAllByText('No responde')).toHaveLength(2)
  })

  it('vuelve a consultar con Actualizar', async () => {
    const props = preparar({ ok: true, estado: estadoBase })
    await screen.findByText('API del panel')
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    await waitFor(() => expect(props.obtener).toHaveBeenCalledTimes(2))
  })

  it('avisa si no se pudo consultar', async () => {
    preparar({ ok: false, motivo: 'fallo' })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo consultar el estado',
    )
  })

  it('avisa a la app cuando la sesión caducó', async () => {
    const props = preparar({ ok: false, motivo: 'sesion' })
    await waitFor(() => expect(props.sesionCaducada).toHaveBeenCalledTimes(1))
  })

  it('muestra el historial de disponibilidad debajo de las tarjetas', async () => {
    const props = preparar({ ok: true, estado: estadoBase })
    expect(
      await screen.findByRole('heading', {
        name: 'Historial de disponibilidad',
      }),
    ).toBeInTheDocument()
    expect(props.obtenerDisponibilidad).toHaveBeenCalledWith('24h')
  })

  it('Actualizar también vuelve a pedir el historial', async () => {
    const props = preparar({ ok: true, estado: estadoBase })
    await screen.findByText('50 %')
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    await waitFor(() =>
      expect(props.obtenerDisponibilidad).toHaveBeenCalledTimes(2),
    )
  })

  it('si falla el historial el resto del estado sigue visible', async () => {
    preparar({ ok: true, estado: estadoBase }, { ok: false, motivo: 'fallo' })
    expect(await screen.findByText('API del panel')).toBeInTheDocument()
    expect(
      await screen.findByText('No se pudo cargar el historial.'),
    ).toBeInTheDocument()
  })
})

describe('PaginaEstado, detalles de las tarjetas', () => {
  it('cada tarjeta dice para qué sirve y cuándo llegó la última lectura', async () => {
    preparar({ ok: true, estado: estadoBase })
    expect(
      await screen.findByText('Cuentas, sesiones y bitácora'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Lecturas que manda el agente IT'),
    ).toBeInTheDocument()
    expect(screen.getByText('Última lectura hace 12 s')).toBeInTheDocument()
  })

  it('sin lecturas la tarjeta de llegada lo dice', async () => {
    preparar({
      ok: true,
      estado: { ...estadoBase, datos: 'sin_datos', variables: [] },
    })
    expect(
      await screen.findByText('Aún no llega ninguna lectura'),
    ).toBeInTheDocument()
  })
})
