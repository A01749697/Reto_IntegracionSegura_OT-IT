import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  ResultadoHistorial,
  ResultadoLecturas,
} from '../gemelo/apiLecturas'
import { NODO } from '../gemelo/nodos'
import PaginaTablero, { SEGUNDOS_ENTRE_CONSULTAS } from './PaginaTablero'

// La última lectura de la celda; la ventana termina aquí.
const FIN = Date.parse('2026-11-26T20:00:00.000Z')
const en = (minutos: number, valor: number) => ({
  ts: new Date(FIN + minutos * 60_000).toISOString(),
  valor,
})

const lectura = (variable: string, valor: number, ms = FIN) => ({
  plc: 'S7-1500',
  variable,
  valor,
  ts: new Date(ms).toISOString(),
})

const LECTURAS: ResultadoLecturas = {
  ok: true,
  lecturas: [
    lectura(NODO.torreta, 3),
    lectura(NODO.falla, 1),
    lectura(NODO.codFalla, 4),
    lectura(NODO.paso, 8, FIN - 5000),
  ],
}

// Lo que el historian tiene de cada nodo en la última hora.
const HISTORIAL: Record<string, { ts: string; valor: number }[]> = {
  [NODO.aluminio]: [en(-90, 40), en(-30, 41), en(-20, 43)],
  [NODO.otras]: [en(-90, 200), en(-10, 201)],
  [NODO.paso]: [en(-61, 0), en(-50, 2), en(-49, 9), en(-48, 0)],
  // 20 min en marcha, 10 en mantenimiento, 10 en marcha, 10 en falla, 10 en paro
  [NODO.torreta]: [en(-120, 1), en(-40, 2), en(-30, 1), en(-20, 3)],
  [NODO.falla]: [en(-120, 0), en(-20, 1), en(-10, 0)],
  [NODO.codFalla]: [en(-120, 0), en(-20, 4)],
  [NODO.tCiclo]: [en(-45, 9.5), en(-35, 10.5)],
  [NODO.tCarreraPd1]: [en(-45, 0.4), en(-35, 0.6)],
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
  it('muestra el estado actual con el mismo letrero que el gemelo', async () => {
    preparar()
    const ahora = await screen.findByRole('region', { name: 'Estado actual' })
    expect(ahora).toHaveTextContent('FALLA · Código 4')
    expect(ahora).toHaveTextContent('8 · Suelta')
  })

  it('calcula los indicadores de la última hora', async () => {
    preparar()
    await screen.findByText('Piezas por tramo')
    expect(tarjeta('Piezas')).toHaveTextContent('4')
    expect(tarjeta('Piezas')).toHaveTextContent('3 aluminio · 1 plástico')
    // 30 min en marcha de 50 sin contar el mantenimiento
    expect(tarjeta('Disponibilidad')).toHaveTextContent('60 %')
    expect(tarjeta('Tiempo de ciclo')).toHaveTextContent('10 s')
    expect(tarjeta('Carrera PD-1')).toHaveTextContent('0.50 s')
    expect(tarjeta('Fallas')).toHaveTextContent('1')
    expect(tarjeta('Fallas')).toHaveTextContent('código 4')
    expect(tarjeta('Mantenimiento')).toHaveTextContent('10 min')
  })

  it('el estado de la celda reparte el tiempo entre los cinco estados', async () => {
    preparar()
    const estados = (
      await screen.findByRole('heading', {
        name: 'Estado de la celda',
      })
    ).closest('section') as HTMLElement
    expect(estados).toHaveTextContent('Marcha30 min')
    expect(estados).toHaveTextContent('Mantenimiento10 min')
    expect(estados).toHaveTextContent('Falla10 min')
    expect(estados).toHaveTextContent('Paro10 min')
  })

  it('lista las fallas con su código y cuánto duraron', async () => {
    preparar()
    const fallas = await screen.findByRole('heading', {
      name: 'Fallas recientes',
    })
    await waitFor(() =>
      expect(screen.getAllByRole('table').length).toBeGreaterThan(0),
    )
    const tabla = screen.getByRole('table')
    expect(tabla).toHaveTextContent('4')
    expect(tabla).toHaveTextContent('10 min')
    expect(fallas).toBeInTheDocument()
  })

  it('la ventana termina en la lectura más reciente de la celda, no en el reloj', async () => {
    const props = preparar()
    await screen.findByText('Piezas por tramo')
    const [, , desde, hasta] = props.obtenerHistorial.mock.calls[0]
    expect(hasta.getTime()).toBe(FIN + 1000)
    // una hora de ventana y otra antes, para saber cómo estaba todo al empezar
    expect(desde.getTime()).toBe(FIN - 2 * 3600_000)
    expect(
      screen.getByText(/Sin lecturas nuevas desde hace/),
    ).toBeInTheDocument()
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

  it('cada tramo de la gráfica de piezas tiene su detalle', async () => {
    preparar()
    await screen.findByText('Piezas por tramo')
    expect(
      screen.getAllByRole('button', { name: /piezas \(.* aluminio/ }),
    ).toHaveLength(12)
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
      'No se pudieron leer',
    )
  })
})
