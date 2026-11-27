import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Cubeta, ResultadoIndicadores, Tramo } from './apiIndicadores'
import PaginaIndicadores from './PaginaIndicadores'

const AHORA = new Date(2026, 10, 25, 15, 30)

const tramo = (inicio: Date, cambios: Partial<Tramo>): Tramo => ({
  inicio: inicio.toISOString(),
  aluminio: 0,
  plastico: 0,
  marcha: 0,
  mantenimiento: 0,
  paro: 0,
  sinRegistro: 0,
  paros: 0,
  fallas: 0,
  ciclos: 0,
  segundosCiclo: 0,
  ...cambios,
})

// El periodo actual produce 30 piezas; el anterior, 20.
function preparar(
  actual: Partial<Tramo> = {
    aluminio: 12,
    plastico: 18,
    marcha: 3 * 3600,
    paro: 3600,
    paros: 2,
    fallas: 3,
    ciclos: 30,
    segundosCiclo: 450,
  },
) {
  const obtener = vi.fn(
    async (
      desde: Date,
      _hasta: Date,
      cubeta: Cubeta,
    ): Promise<ResultadoIndicadores> => {
      const esActual = desde.getTime() >= new Date(2026, 10, 19).getTime()
      const dias = cubeta === 'hora' ? 24 : 7
      const tramos = Array.from({ length: dias }, (_, i) =>
        tramo(
          new Date(
            desde.getTime() + i * (cubeta === 'hora' ? 3600 : 86400) * 1000,
          ),
          i === 0
            ? esActual
              ? actual
              : {
                  aluminio: 10,
                  plastico: 10,
                  marcha: 3600,
                  paro: 3600,
                  paros: 4,
                }
            : {},
        ),
      )
      const fallas = esActual
        ? [
            { ts: desde.toISOString(), codigo: 3 },
            { ts: desde.toISOString(), codigo: 3 },
            { ts: desde.toISOString(), codigo: 1 },
          ]
        : []
      return { ok: true, tramos, fallas, truncado: false }
    },
  )
  const props = {
    obtener,
    descargar: vi.fn(),
    sesionCaducada: vi.fn(),
    ahora: () => AHORA,
  }
  render(<PaginaIndicadores {...props} />)
  return props
}

const tarjeta = (titulo: string) =>
  screen.getByRole('heading', { name: titulo }).parentElement as HTMLElement

beforeEach(() => vi.clearAllMocks())

describe('PaginaIndicadores', () => {
  it('abre en 7 días y compara contra los 7 anteriores', async () => {
    const { obtener } = preparar()
    await screen.findByText('Producción por día')
    const [actual, anterior] = obtener.mock.calls
    expect(actual?.[0]).toEqual(new Date(2026, 10, 19))
    expect(actual?.[2]).toBe('dia')
    expect(anterior?.[1]).toEqual(new Date(2026, 10, 19))

    expect(tarjeta('Producción')).toHaveTextContent('30')
    expect(tarjeta('Producción')).toHaveTextContent(
      '+50 % vs. periodo anterior',
    )
    // 3 h en marcha de 4 con datos; antes 50 %
    expect(tarjeta('Disponibilidad')).toHaveTextContent('75.0 %')
    expect(tarjeta('Disponibilidad')).toHaveTextContent('+25.0 pts')
    expect(tarjeta('Piezas por hora')).toHaveTextContent('10.0')
    expect(tarjeta('Tiempo de ciclo')).toHaveTextContent('15.0 s')
    // menos paros es mejor: la baja se pinta como buena
    expect(tarjeta('Paros')).toHaveTextContent('−50 %')
    expect(tarjeta('Fallas')).toHaveTextContent('3')
    // el código 3 salió dos veces: va primero
    const pareto = screen.getByRole('heading', { name: 'Fallas por código' })
      .parentElement?.parentElement?.parentElement as HTMLElement
    expect(pareto).toHaveTextContent(/Código 3.*2 veces.*Código 1.*1 vez/)
  })

  it('cada día de la gráfica tiene su detalle y hay tabla', async () => {
    preparar()
    await screen.findByText('Producción por día')
    expect(
      screen.getAllByRole('button', { name: /piezas \(.* aluminio/ }),
    ).toHaveLength(7)
    expect(screen.getByText('Detalle por tramo')).toBeInTheDocument()
  })

  it('hoy va por hora', async () => {
    const { obtener } = preparar()
    await screen.findByText('Producción por día')
    fireEvent.click(screen.getByRole('button', { name: 'Hoy' }))
    expect(await screen.findByText('Producción por hora')).toBeInTheDocument()
    expect(obtener.mock.calls.at(-1)?.[2]).toBe('hora')
  })

  it('descarga el detalle como CSV', async () => {
    const { descargar } = preparar()
    await screen.findByText('Producción por día')
    fireEvent.click(screen.getByRole('button', { name: 'Descargar CSV' }))
    const [nombre, archivo] = descargar.mock.calls[0] as [string, Blob]
    expect(nombre).toBe(
      `indicadores-7d-${AHORA.toISOString().slice(0, 10)}.csv`,
    )
    expect(await archivo.text()).toContain('inicio,aluminio,plastico')
  })

  it('sin actividad lo dice en lugar de mostrar ceros sin explicación', async () => {
    preparar({})
    expect(
      await screen.findByText(/Sin actividad registrada/),
    ).toBeInTheDocument()
  })

  it('si la sesión venció, avisa', async () => {
    const props = {
      obtener: vi.fn().mockResolvedValue({ ok: false, motivo: 'sesion' }),
      descargar: vi.fn(),
      sesionCaducada: vi.fn(),
    }
    render(<PaginaIndicadores {...props} />)
    await waitFor(() => expect(props.sesionCaducada).toHaveBeenCalled())
  })

  it('si no se pudo calcular, lo dice', async () => {
    render(
      <PaginaIndicadores
        obtener={vi.fn().mockResolvedValue({ ok: false, motivo: 'fallo' })}
        descargar={vi.fn()}
        sesionCaducada={vi.fn()}
      />,
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudieron calcular',
    )
  })
})
