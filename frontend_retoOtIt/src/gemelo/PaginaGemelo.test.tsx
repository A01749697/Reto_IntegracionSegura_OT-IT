import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../idioma/i18n'
import type {
  ResultadoCambios,
  ResultadoLecturas,
  UltimaLectura,
} from './apiLecturas'
import { avanzarGemelo, type Gemelo } from './gemelo'
import { NODO, NODOS_TABLERO, PLC_TABLERO } from './nodos'
import PaginaGemelo, { SEGUNDOS_CAMBIOS } from './PaginaGemelo'

// jsdom no tiene WebGL: la vista 3D se cambia por un botón que hace lo que hace un cuadro.
vi.mock('./VistaCelda', () => ({
  default: ({
    gemelo,
    alRefrescar,
  }: {
    gemelo: Gemelo
    alRefrescar: () => void
  }) => (
    <button
      type="button"
      onClick={() => {
        avanzarGemelo(gemelo, 0.1)
        avanzarGemelo(gemelo, 0.1)
        alRefrescar()
      }}
    >
      vista 3D
    </button>
  ),
}))

const TS = '2026-11-26T20:00:00.000Z'

const lectura = (
  plc: string,
  variable: string,
  valor: number,
  ts = new Date().toISOString(),
): UltimaLectura => ({ plc, variable, valor, ts })

function lecturas(torreta = 1, extra: UltimaLectura[] = []): ResultadoLecturas {
  const ahora = new Date().toISOString()
  return {
    ok: true,
    lecturas: [
      lectura(PLC_TABLERO, NODO.torreta, torreta, ahora),
      lectura(PLC_TABLERO, NODO.latido, 77, ahora),
      lectura(PLC_TABLERO, NODO.paso, 5, ahora),
      lectura(PLC_TABLERO, NODO.ciclos, 302, ahora),
      lectura('S7-300', 'CONTADOR_PIEZAS', 12, ahora),
      ...extra,
    ],
  }
}

function preparar(
  respuesta: ResultadoLecturas = lecturas(),
  cambios: ResultadoCambios = { ok: true, cambios: [], truncado: false },
) {
  const props = {
    obtenerLecturas: vi.fn().mockResolvedValue(respuesta),
    obtenerCambios: vi.fn().mockResolvedValue(cambios),
    sesionCaducada: vi.fn(),
  }
  render(<PaginaGemelo {...props} />)
  return props
}

const pulsar = (nombre: string) =>
  fireEvent.click(screen.getByRole('button', { name: nombre }))

const letrero = (nombre = 'Estado de la celda') =>
  screen.getByRole('status', { name: nombre })

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.useRealTimers())

describe('PaginaGemelo en vivo', () => {
  it('arranca con la última lectura: letrero, paso y datos del S7-1516', async () => {
    preparar()
    expect(
      screen.getByRole('heading', { name: 'Gemelo digital' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('En línea')).toBeInTheDocument()
    pulsar('vista 3D')
    expect(letrero()).toHaveTextContent('EN MARCHA')
    const datos = screen.getByRole('region', { name: 'Datos de la celda' })
    expect(within(datos).getByText('5 · Aprieta')).toBeInTheDocument()
    expect(within(datos).getByText('302')).toBeInTheDocument()
    expect(within(datos).getByText(NODO.tCarreraPd1)).toBeInTheDocument()
  })

  it.each([
    [2, 'MANTENIMIENTO'],
    [3, 'PARO'],
    [4, 'RESET / REGRESO A INICIO'],
    [8, 'SIN DATO'],
  ])('TAB_TORRETA %i se ve como %s', async (torreta, texto) => {
    preparar(lecturas(torreta))
    await screen.findByText('En línea')
    pulsar('vista 3D')
    expect(letrero()).toHaveTextContent(texto)
  })

  it('una falla muestra su código', async () => {
    preparar(
      lecturas(3, [
        lectura(PLC_TABLERO, NODO.falla, 1),
        lectura(PLC_TABLERO, NODO.codFalla, 7),
      ]),
    )
    await screen.findByText('En línea')
    pulsar('vista 3D')
    expect(letrero()).toHaveTextContent('FALLA')
    expect(letrero()).toHaveTextContent('Código 7')
  })

  it('pide los cambios de los nodos del S7-1516 desde la última lectura, y luego desde el último cambio', async () => {
    vi.useFakeTimers()
    const props = preparar(lecturas(1, [lectura(PLC_TABLERO, 'TAB_X', 1, TS)]))
    await vi.advanceTimersByTimeAsync(100)
    props.obtenerCambios.mockResolvedValueOnce({
      ok: true,
      cambios: [{ nodo: NODO.paso, ts: '2030-01-01T00:00:05.000Z', valor: 6 }],
      truncado: false,
    })
    await vi.advanceTimersByTimeAsync(SEGUNDOS_CAMBIOS * 1000)
    const [plc, nodos, desde] = props.obtenerCambios.mock.calls[0] as [
      string,
      string[],
      Date,
    ]
    expect(plc).toBe(PLC_TABLERO)
    expect(nodos).toEqual(NODOS_TABLERO)
    expect(desde.getTime()).toBeGreaterThan(Date.parse(TS))
    await vi.advanceTimersByTimeAsync(SEGUNDOS_CAMBIOS * 1000)
    const segunda = props.obtenerCambios.mock.calls[1][2] as Date
    expect(segunda.toISOString()).toBe('2030-01-01T00:00:05.000Z')
  })

  it('si la respuesta venía recortada, pide lo que sigue sin esperar', async () => {
    vi.useFakeTimers()
    const props = preparar()
    await vi.advanceTimersByTimeAsync(100)
    props.obtenerCambios.mockResolvedValueOnce({
      ok: true,
      cambios: [],
      truncado: true,
    })
    await vi.advanceTimersByTimeAsync(SEGUNDOS_CAMBIOS * 1000 + 10)
    expect(props.obtenerCambios).toHaveBeenCalledTimes(2)
  })

  it('sin lecturas lo dice', async () => {
    preparar({ ok: true, lecturas: [] })
    expect(
      await screen.findByText('El historian no tiene lecturas.'),
    ).toBeInTheDocument()
  })

  it('avisa si no se pudo consultar', async () => {
    preparar({ ok: false, motivo: 'fallo' })
    expect(
      await screen.findByText('El panel no responde. Reintentando.'),
    ).toBeInTheDocument()
  })

  it('avisa a la app cuando la sesión caducó', async () => {
    const props = preparar({ ok: false, motivo: 'sesion' })
    await waitFor(() => expect(props.sesionCaducada).toHaveBeenCalled())
  })

  it('no ofrece mandos: en vivo solo se lee', async () => {
    preparar()
    await screen.findByText('En línea')
    expect(screen.queryByRole('button', { name: 'Marcha' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull()
  })

  it('la velocidad no se puede cambiar: va al ritmo de la celda', () => {
    preparar()
    expect(screen.getByRole('slider')).toBeDisabled()
  })
})

describe('PaginaGemelo en simulación', () => {
  async function enSimulacion() {
    const props = preparar()
    await screen.findByText('En línea')
    pulsar('Simulación')
    return props
  }

  it('ofrece los mandos del operador y deja de consultar', async () => {
    vi.useFakeTimers()
    const props = preparar()
    await vi.advanceTimersByTimeAsync(100)
    pulsar('Simulación')
    const llamadas = props.obtenerLecturas.mock.calls.length
    await vi.advanceTimersByTimeAsync(20_000)
    expect(props.obtenerLecturas).toHaveBeenCalledTimes(llamadas)
    expect(screen.getByText('Datos simulados')).toBeInTheDocument()
    for (const mando of ['Marcha', 'Paro', 'Mantenimiento', 'Reset'])
      expect(screen.getByRole('button', { name: mando })).toBeInTheDocument()
    expect(screen.getByRole('slider')).toBeEnabled()
  })

  it('arranca en marcha; Paro y Mantenimiento cambian el letrero', async () => {
    await enSimulacion()
    pulsar('vista 3D')
    expect(letrero()).toHaveTextContent('EN MARCHA')
    pulsar('Paro')
    pulsar('vista 3D')
    expect(letrero()).toHaveTextContent('PARO')
    pulsar('Mantenimiento')
    pulsar('vista 3D')
    expect(letrero()).toHaveTextContent('MANTENIMIENTO')
    expect(
      screen.getByRole('button', { name: 'Mantenimiento' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('Reset muestra RESET / REGRESO A INICIO', async () => {
    await enSimulacion()
    pulsar('Reset')
    pulsar('vista 3D')
    expect(letrero()).toHaveTextContent('RESET / REGRESO A INICIO')
  })

  it('trabar PD-1 termina en falla con su código y su descripción', async () => {
    await enSimulacion()
    pulsar('Trabar PD-1')
    act(() => {
      for (let i = 0; i < 30; i++) pulsar('vista 3D')
    })
    expect(letrero()).toHaveTextContent('FALLA')
    expect(letrero()).toHaveTextContent('Código 1')
    expect(
      screen.getByText('Código 1: PD-1 no llegó a TAB_FINC_EMPUJAR'),
    ).toBeInTheDocument()
  })

  it('cortar la comunicación termina en SIN COMUNICACIÓN', async () => {
    await enSimulacion()
    pulsar('vista 3D')
    pulsar('Cortar comunicación')
    act(() => {
      for (let i = 0; i < 30; i++) pulsar('vista 3D')
    })
    expect(letrero()).toHaveTextContent('SIN COMUNICACIÓN')
  })

  it('al volver a En vivo consulta de nuevo', async () => {
    const props = await enSimulacion()
    const llamadas = props.obtenerLecturas.mock.calls.length
    pulsar('En vivo')
    await waitFor(() =>
      expect(props.obtenerLecturas).toHaveBeenCalledTimes(llamadas + 1),
    )
  })
})

describe('PaginaGemelo, secuencia y vista', () => {
  it('lista los diez pasos del S7-1516 y marca el actual', async () => {
    preparar()
    await screen.findByText('En línea')
    pulsar('vista 3D')
    const secuencia = screen.getByRole('list', {
      name: 'Secuencia del S7-1516',
    })
    expect(within(secuencia).getAllByRole('listitem')).toHaveLength(10)
    expect(
      within(secuencia).getByText('Aprieta').closest('li'),
    ).toHaveAttribute('aria-current', 'step')
  })

  it('marca la vista elegida', () => {
    preparar()
    pulsar('Marcado')
    expect(screen.getByRole('button', { name: 'Marcado' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})

describe('PaginaGemelo en inglés', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('muestra el letrero, los datos y los mandos en inglés', async () => {
    preparar()
    await screen.findByText('Online')
    pulsar('vista 3D')
    expect(letrero('Cell status')).toHaveTextContent('RUNNING')
    pulsar('Simulation')
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
    expect(screen.getByText('Outputs')).toBeInTheDocument()
  })
})
