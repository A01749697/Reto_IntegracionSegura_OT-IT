import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  ResultadoHistorial,
  ResultadoLecturas,
} from '../gemelo/apiLecturas'
import { NODOS } from '../gemelo/nodos'
import PaginaTablero, { SEGUNDOS_ENTRE_CONSULTAS } from './PaginaTablero'

// La última lectura de la celda; la ventana termina aquí.
const FIN = Date.parse('2026-11-24T20:00:00.000Z')
const en = (minutos: number, valor: number) => ({
  ts: new Date(FIN + minutos * 60_000).toISOString(),
  valor,
})

const LECTURAS: ResultadoLecturas = {
  ok: true,
  lecturas: [
    {
      plc: 'S7-1500',
      variable: NODOS.torreta.nodo,
      valor: 1,
      ts: new Date(FIN).toISOString(),
    },
    {
      plc: 'S7-1500',
      variable: NODOS.paso.nodo,
      valor: 8,
      ts: new Date(FIN - 5000).toISOString(),
    },
  ],
}

// Lo que el historian tiene de cada nodo en la última hora.
const HISTORIAL: Record<string, { ts: string; valor: number }[]> = {
  [NODOS.piezasAluminio.nodo]: [en(-90, 40), en(-30, 41), en(-20, 43)],
  [NODOS.piezasOtras.nodo]: [en(-90, 200), en(-10, 201)],
  [NODOS.paso.nodo]: [
    en(-61, 0),
    en(-50, 2),
    en(-49, 9),
    en(-48, 0),
    en(-40, 2),
    en(-39.5, 9),
    en(-39, 0),
  ],
  [NODOS.torreta.nodo]: [en(-120, 3), en(-30, 1)],
}

function preparar(lecturas: ResultadoLecturas = LECTURAS) {
  const props = {
    obtenerLecturas: vi.fn().mockResolvedValue(lecturas),
    obtenerHistorial: vi.fn<
      (
        plc: string,
        nodo: string,
        desde: Date,
        hasta: Date,
      ) => Promise<ResultadoHistorial>
    >(async (_plc, nodo) => ({ ok: true, puntos: HISTORIAL[nodo] ?? [] })),
    sesionCaducada: vi.fn(),
  }
  render(<PaginaTablero {...props} />)
  return props
}

const tarjeta = (titulo: string) =>
  screen.getByRole('heading', { name: titulo }).parentElement as HTMLElement

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.useRealTimers())

describe('PaginaTablero', () => {
  it('muestra las piezas, el ciclo y el tiempo en marcha de la última hora', async () => {
    preparar()
    await screen.findByText('Piezas por tramo')
    expect(tarjeta('Piezas')).toHaveTextContent('4')
    expect(tarjeta('Piezas')).toHaveTextContent('75 % aluminio · 25 % plástico')
    expect(tarjeta('Aluminio')).toHaveTextContent('3')
    expect(tarjeta('Plástico')).toHaveTextContent('1')
    // dos ciclos: 2 min y 1 min
    expect(tarjeta('Ciclo promedio')).toHaveTextContent('1 min 30 s')
    expect(tarjeta('En marcha')).toHaveTextContent('50 %')
    expect(tarjeta('Ahora')).toHaveTextContent('8 · Suelta')
  })

  it('la ventana termina en la lectura más reciente de la celda, no en el reloj', async () => {
    const props = preparar()
    await screen.findByText('Piezas por tramo')
    const [, , desde, hasta] = props.obtenerHistorial.mock.calls[0]
    expect(hasta.getTime()).toBe(FIN + 1000)
    // una hora de ventana y otra antes, para saber cómo estaba todo al empezar
    expect(desde.getTime()).toBe(FIN - 2 * 3600_000)
    expect(screen.getByText(/no envía lecturas desde hace/)).toBeInTheDocument()
  })

  it('al cambiar el periodo vuelve a pedir el historial con la nueva ventana', async () => {
    const props = preparar()
    await screen.findByText('Piezas por tramo')
    fireEvent.click(screen.getByRole('button', { name: '24 horas' }))
    await waitFor(() => {
      const ultima = props.obtenerHistorial.mock.calls.at(-1)!
      expect(ultima[2].getTime()).toBe(FIN - 48 * 3600_000)
    })
  })

  it('cada tramo de la gráfica tiene su detalle y también hay tabla', async () => {
    preparar()
    await screen.findByText('Piezas por tramo')
    expect(
      screen.getAllByRole('button', { name: /de aluminio, .* de plástico/ }),
    ).toHaveLength(12)
    expect(screen.getByText('Ver como tabla')).toBeInTheDocument()
  })

  it('se actualiza solo', async () => {
    vi.useFakeTimers()
    const props = preparar()
    await vi.advanceTimersByTimeAsync(100)
    expect(props.obtenerLecturas).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(SEGUNDOS_ENTRE_CONSULTAS * 1000)
    expect(props.obtenerLecturas).toHaveBeenCalledTimes(2)
  })

  it('si la sesión venció, avisa', async () => {
    const props = preparar({ ok: false, motivo: 'sesion' })
    await waitFor(() => expect(props.sesionCaducada).toHaveBeenCalled())
  })

  it('si no se pudo consultar, lo dice', async () => {
    preparar({ ok: false, motivo: 'fallo' })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudieron consultar',
    )
  })
})
