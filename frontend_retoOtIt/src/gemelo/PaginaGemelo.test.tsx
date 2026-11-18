import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResultadoLecturas, UltimaLectura } from './apiLecturas'
import PaginaGemelo from './PaginaGemelo'

// jsdom no tiene WebGL: la vista 3D se cambia por un botón que hace lo que hace cada cuadro.
vi.mock('./VistaCelda', () => ({
  default: ({ alRefrescar }: { alRefrescar: () => void }) => (
    <button type="button" onClick={alRefrescar}>
      vista 3D
    </button>
  ),
}))

const lectura = (
  variable: string,
  valor: number,
  ts: string,
): UltimaLectura => ({ plc: 'S7-1500', variable, valor, ts })

function lecturasDeAhora(contador = 12): ResultadoLecturas {
  const ts = new Date().toISOString()
  return {
    ok: true,
    lecturas: [
      lectura('estado_estacion', 1, ts),
      lectura('estado_piston', 0, ts),
      lectura('presencia_pieza', 1, ts),
      lectura('contador_piezas', contador, ts),
    ],
  }
}

function preparar(respuesta: ResultadoLecturas) {
  const props = {
    obtenerLecturas: vi.fn().mockResolvedValue(respuesta),
    sesionCaducada: vi.fn(),
  }
  render(<PaginaGemelo {...props} />)
  return props
}

const elegir = (modo: string) =>
  fireEvent.click(screen.getByRole('button', { name: modo }))

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.useRealTimers())

describe('PaginaGemelo en vivo', () => {
  it('abre en vivo y muestra lo que manda la celda', async () => {
    preparar(lecturasDeAhora())
    expect(
      screen.getByRole('heading', { name: 'Gemelo digital' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Datos en vivo')).toBeInTheDocument()
    expect(screen.getByText('En marcha')).toBeInTheDocument()
    expect(screen.getByText('Atrás')).toBeInTheDocument()
    expect(screen.getByText('Sí')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText(/Última lectura:/)).toBeInTheDocument()
  })

  it('carga la vista 3D', async () => {
    preparar(lecturasDeAhora())
    expect(
      await screen.findByRole('button', { name: 'vista 3D' }),
    ).toBeInTheDocument()
  })

  it('no ofrece mandos: desde el panel no se le ordena nada a la celda', async () => {
    preparar(lecturasDeAhora())
    await screen.findByText('Datos en vivo')
    expect(screen.queryByRole('button', { name: 'Marcha' })).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Paro de emergencia' }),
    ).toBeNull()
  })

  it('sin lecturas lo explica y sugiere la simulación', async () => {
    preparar({ ok: true, lecturas: [] })
    expect(await screen.findByText('Sin lecturas todavía')).toBeInTheDocument()
    expect(screen.getByText(/Aún no llega ninguna lectura/)).toBeInTheDocument()
  })

  it('avisa si las lecturas están atrasadas', async () => {
    preparar({
      ok: true,
      lecturas: [lectura('contador_piezas', 5, '2026-01-01T00:00:00.000Z')],
    })
    expect(await screen.findByText('Lecturas atrasadas')).toBeInTheDocument()
  })

  it('avisa si no se pudo consultar', async () => {
    preparar({ ok: false, motivo: 'fallo' })
    expect(await screen.findByText('Sin conexión')).toBeInTheDocument()
    expect(
      screen.getByText(/No se pudieron consultar las lecturas/),
    ).toBeInTheDocument()
  })

  it('avisa a la app cuando la sesión caducó', async () => {
    const props = preparar({ ok: false, motivo: 'sesion' })
    await waitFor(() => expect(props.sesionCaducada).toHaveBeenCalledTimes(1))
  })

  it('vuelve a consultar cada 5 segundos', async () => {
    vi.useFakeTimers()
    const props = preparar(lecturasDeAhora())
    await vi.advanceTimersByTimeAsync(100)
    expect(props.obtenerLecturas).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(props.obtenerLecturas).toHaveBeenCalledTimes(3)
  })

  it('muestra el contador nuevo cuando la celda cuenta otra pieza', async () => {
    vi.useFakeTimers()
    const props = preparar(lecturasDeAhora(12))
    await vi.advanceTimersByTimeAsync(100)
    props.obtenerLecturas.mockResolvedValue(lecturasDeAhora(13))
    await vi.advanceTimersByTimeAsync(5000)
    vi.useRealTimers()
    expect(await screen.findByText('13')).toBeInTheDocument()
  })
})

describe('PaginaGemelo en simulación', () => {
  it('muestra los mandos y deja de consultar la nube', async () => {
    vi.useFakeTimers()
    const props = preparar(lecturasDeAhora())
    await vi.advanceTimersByTimeAsync(100)
    elegir('Simulación')
    expect(screen.getByText('Datos simulados')).toBeInTheDocument()
    for (const mando of ['Marcha', 'Paro', 'Paro de emergencia', 'Restablecer'])
      expect(screen.getByRole('button', { name: mando })).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(20_000)
    expect(props.obtenerLecturas).toHaveBeenCalledTimes(1)
  })

  it('el paro de emergencia se ve en el estado y Restablecer lo quita', async () => {
    preparar(lecturasDeAhora())
    elegir('Simulación')
    const refrescar = await screen.findByRole('button', { name: 'vista 3D' })
    fireEvent.click(screen.getByRole('button', { name: 'Paro de emergencia' }))
    fireEvent.click(refrescar)
    expect(screen.getByText('Emergencia')).toBeInTheDocument()
    expect(screen.getByText(/Paro de emergencia activo/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer' }))
    fireEvent.click(refrescar)
    expect(screen.getByText('Reposo')).toBeInTheDocument()
  })

  it('al volver a En vivo consulta de nuevo', async () => {
    const props = preparar(lecturasDeAhora())
    await screen.findByText('Datos en vivo')
    elegir('Simulación')
    elegir('En vivo')
    await waitFor(() => expect(props.obtenerLecturas).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Datos en vivo')).toBeInTheDocument()
  })
})

describe('PaginaGemelo, vista y secuencia', () => {
  it('lista los siete pasos del proceso', () => {
    preparar(lecturasDeAhora())
    const pasos = screen.getByRole('list', { name: 'Secuencia del proceso' })
    expect(pasos.textContent).toBe(
      '1Alimentar2Identificar3Sujetar y marcar4Llevar a toma5Tomar6Clasificar7Empacar',
    )
  })

  it('marca la vista elegida', () => {
    preparar(lecturasDeAhora())
    expect(screen.getByRole('button', { name: 'General' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Pórtico' }))
    expect(screen.getByRole('button', { name: 'Pórtico' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'General' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('deja cambiar la velocidad y ocultar las etiquetas', () => {
    preparar(lecturasDeAhora())
    fireEvent.change(screen.getByRole('slider'), { target: { value: '2' } })
    expect(screen.getByText('2x')).toBeInTheDocument()
    const etiquetas = screen.getByRole('checkbox', {
      name: 'Etiquetas en la escena',
    })
    expect(etiquetas).toBeChecked()
    fireEvent.click(etiquetas)
    expect(etiquetas).not.toBeChecked()
  })

  it('las señales empiezan con la celda en reposo', () => {
    preparar(lecturasDeAhora())
    expect(screen.getByText('Reposo')).toBeInTheDocument()
    expect(screen.getByText('Alimentador atrás')).toBeInTheDocument()
    expect(screen.getByText('Sin pieza')).toBeInTheDocument()
    expect(screen.getByText('6.00 bar')).toBeInTheDocument()
  })
})
