import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  ResultadoHistorial,
  ResultadoLecturas,
} from '../gemelo/apiLecturas'
import type {
  Cubeta,
  ResultadoIndicadores,
  Tramo,
} from '../indicadores/apiIndicadores'
import PaginaTablero from './PaginaTablero'

const AHORA = new Date(2026, 10, 25, 15, 30)
// la lectura más reciente de la celda; la operación reciente termina aquí
const FIN = Date.parse('2026-11-26T20:00:00.000Z')

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

// Hoy produce 30 piezas; ayer, 20.
async function indicadores(
  desde: Date,
  _hasta: Date,
  cubeta: Cubeta,
): Promise<ResultadoIndicadores> {
  const esHoy = desde.getTime() >= new Date(2026, 10, 25).getTime()
  const n = cubeta === 'hora' ? 24 : 7
  const paso = (cubeta === 'hora' ? 3600 : 86400) * 1000
  const tramos = Array.from({ length: n }, (_, i) =>
    tramo(
      new Date(desde.getTime() + i * paso),
      i > 0
        ? {}
        : esHoy
          ? {
              aluminio: 12,
              plastico: 18,
              marcha: 3 * 3600,
              paro: 3600,
              paros: 2,
              fallas: 3,
              ciclos: 30,
              segundosCiclo: 450,
            }
          : { aluminio: 10, plastico: 10, marcha: 3600, paro: 3600 },
    ),
  )
  const fallas = esHoy
    ? [
        { ts: desde.toISOString(), codigo: 3 },
        { ts: desde.toISOString(), codigo: 3 },
        { ts: desde.toISOString(), codigo: 1 },
      ]
    : []
  return { ok: true, tramos, fallas, truncado: false }
}

const lectura = (variable: string, valor: number, ms = FIN) => ({
  plc: 'S7-1500',
  variable,
  valor,
  ts: new Date(ms).toISOString(),
})

const LECTURAS: ResultadoLecturas = {
  ok: true,
  lecturas: [
    lectura('TAB_TORRETA', 3),
    lectura('TAB_FALLA', 1),
    lectura('TAB_COD_FALLA', 4),
    lectura('TAB_PASO', 8, FIN - 5000),
  ],
}

// minuto m antes del final de la ventana
const en = (m: number, valor: number) => ({
  ts: new Date(FIN + m * 60_000).toISOString(),
  valor,
})
const HISTORIAL: Record<string, { ts: string; valor: number }[]> = {
  TAB_PASO: [en(-61, 0), en(-50, 2), en(-49, 9), en(-48, 0)],
  // 20 min en marcha, 10 en mantenimiento, 10 en marcha, 10 en falla, 10 en paro
  TAB_TORRETA: [en(-60, 1), en(-40, 2), en(-30, 1), en(-20, 3)],
  TAB_FALLA: [en(-60, 0), en(-20, 1), en(-10, 0)],
  TAB_COD_FALLA: [en(-60, 0), en(-20, 4)],
  TAB_T_CICLO_S: [en(-45, 9.5), en(-35, 10.5)],
  TAB_T_CARRERA_PD1_S: [en(-45, 0.4), en(-35, 0.6)],
  PIEZAS_ALUMINIO: [en(-90, 100), en(-30, 103)],
  PIEZAS_OTRAS: [en(-90, 50), en(-25, 51)],
  TIEMPO_CICLO_S: [en(-30, 6), en(-25, 8)],
}

function preparar(
  lecturas: ResultadoLecturas = LECTURAS,
  obtener = vi.fn(indicadores),
) {
  const props = {
    obtener,
    obtenerLecturas: vi.fn().mockResolvedValue(lecturas),
    obtenerHistorial: vi.fn<
      (
        plc: string,
        nodo: string,
        desde: Date,
        hasta: Date,
      ) => Promise<ResultadoHistorial>
    >(async (_plc, nodo) => ({ ok: true, puntos: HISTORIAL[nodo] ?? [] })),
    descargar: vi.fn(),
    sesionCaducada: vi.fn(),
    ahora: () => AHORA,
  }
  render(<PaginaTablero {...props} />)
  return props
}

const tarjeta = (titulo: string) =>
  screen.getByRole('heading', { name: titulo }).parentElement as HTMLElement

beforeEach(() => vi.clearAllMocks())

describe('PaginaTablero', () => {
  it('arriba dice cómo está la celda ahora', async () => {
    preparar()
    const ahora = await screen.findByRole('region', { name: 'Estado actual' })
    expect(ahora).toHaveTextContent('FALLA · Código 4')
    expect(ahora).toHaveTextContent('8 · Suelta')
  })

  it('abre en hoy, por hora, y compara contra ayer', async () => {
    const { obtener } = preparar()
    await screen.findByText('Producción por hora')
    expect(obtener.mock.calls[0]?.[2]).toBe('hora')
    expect(tarjeta('Producción')).toHaveTextContent('30')
    expect(tarjeta('Producción')).toHaveTextContent(
      '+50 % vs. periodo anterior',
    )
    expect(tarjeta('Disponibilidad')).toHaveTextContent('75.0 %')
    expect(tarjeta('Fallas')).toHaveTextContent('3')
  })

  it('la operación reciente termina en la última lectura de la celda e incluye la garra', async () => {
    const props = preparar()
    await screen.findByText('Tendencia de la carrera PD-1')
    const [, , desde, hasta] = props.obtenerHistorial.mock.calls[0]
    expect(hasta.getTime()).toBe(FIN + 1000)
    // 8 h de ventana y otras 8 antes, para saber cómo estaba todo al empezar
    expect(desde.getTime()).toBe(FIN - 16 * 3600_000)
    expect(tarjeta('Clasificadas por la garra')).toHaveTextContent('4')
    expect(tarjeta('Ciclo de la garra')).toHaveTextContent('7 s')
    expect(tarjeta('Carrera PD-1')).toHaveTextContent('0.50 s')
  })

  it('reparte el tiempo entre los estados de la celda y lista las fallas', async () => {
    preparar()
    const estados = (
      await screen.findByRole('heading', { name: 'Estado de la celda' })
    ).closest('section') as HTMLElement
    expect(estados).toHaveTextContent('Marcha30 min')
    expect(estados).toHaveTextContent('Mantenimiento10 min')
    expect(estados).toHaveTextContent('Falla10 min')
    const fallas = screen
      .getByRole('heading', { name: 'Fallas recientes' })
      .closest('section') as HTMLElement
    expect(fallas).toHaveTextContent('10 min')
  })

  it('descarga el detalle como CSV', async () => {
    const { descargar } = preparar()
    await screen.findByText('Producción por hora')
    fireEvent.click(screen.getByRole('button', { name: 'Descargar CSV' }))
    const [nombre, archivo] = descargar.mock.calls[0] as [string, Blob]
    expect(nombre).toMatch(/^indicadores-hoy-.*\.csv$/)
    expect(await archivo.text()).toContain('inicio,aluminio,plastico')
  })

  it('si la sesión venció, avisa', async () => {
    const props = preparar({ ok: false, motivo: 'sesion' })
    await waitFor(() => expect(props.sesionCaducada).toHaveBeenCalled())
  })

  it('si no se pudieron calcular los indicadores, lo dice', async () => {
    preparar(
      LECTURAS,
      vi.fn().mockResolvedValue({ ok: false, motivo: 'fallo' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudieron calcular',
    )
  })
})
