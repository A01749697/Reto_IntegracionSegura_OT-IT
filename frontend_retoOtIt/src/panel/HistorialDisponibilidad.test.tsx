import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../idioma/i18n'
import type {
  Disponibilidad,
  ResultadoDisponibilidad,
  VentanaDisponibilidad,
} from './apiSistema'
import HistorialDisponibilidad from './HistorialDisponibilidad'

const base: Disponibilidad = {
  ventana: '24h',
  cubetaSegundos: 900,
  hasta: '2026-11-12T12:07:00.000Z',
  cubetas: [
    {
      inicio: '2026-11-12T11:15:00.000Z',
      lecturas: 0,
      estado: 'sin_historial',
    },
    { inicio: '2026-11-12T11:30:00.000Z', lecturas: 1, estado: 'con_datos' },
    { inicio: '2026-11-12T11:45:00.000Z', lecturas: 0, estado: 'sin_datos' },
    { inicio: '2026-11-12T12:00:00.000Z', lecturas: 0, estado: 'en_curso' },
  ],
  resumen: {
    porcentaje: 50,
    cubetasEvaluadas: 2,
    cubetasConDatos: 1,
    interrupciones: 1,
    mayorCorteSegundos: 5400,
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
  respuesta: ResultadoDisponibilidad = { ok: true, disponibilidad: base },
  recarga = 0,
) {
  const props = {
    obtener: vi
      .fn<(v: VentanaDisponibilidad) => Promise<ResultadoDisponibilidad>>()
      .mockResolvedValue(respuesta),
    sesionCaducada: vi.fn(),
    recarga,
  }
  const vista = render(<HistorialDisponibilidad {...props} />)
  return { props, ...vista }
}

beforeEach(() => vi.clearAllMocks())

describe('HistorialDisponibilidad', () => {
  it('pide las últimas 24 horas y muestra el resumen', async () => {
    const { props } = preparar()
    expect(await screen.findByText('50 %')).toBeInTheDocument()
    expect(props.obtener).toHaveBeenCalledWith('24h')
    expect(screen.getByText('Disponibilidad')).toBeInTheDocument()
    expect(screen.getByText('1 h 30 min')).toBeInTheDocument()
  })

  it('dibuja una barra por cada tramo y la describe para lectores de pantalla', async () => {
    preparar()
    const grafica = await screen.findByRole('img', {
      name: 'Disponibilidad. Últimas 24 h: 50 %, 1 interrupción.',
    })
    expect(grafica.children).toHaveLength(base.cubetas.length)
  })

  it('cada barra dice cuántas lecturas llegaron en su tramo', async () => {
    preparar()
    const grafica = await screen.findByRole('img')
    const textos = Array.from(grafica.children).map((c) =>
      c.getAttribute('title'),
    )
    expect(textos[1]).toMatch(/1 lectura$/)
    expect(textos[2]).toMatch(/0 lecturas$/)
  })

  it('la leyenda solo nombra los estados que aparecen', async () => {
    preparar()
    expect(await screen.findByText('Llegaron lecturas')).toBeInTheDocument()
    expect(screen.getByText('Sin lecturas')).toBeInTheDocument()
    expect(screen.getByText('Antes de la primera lectura')).toBeInTheDocument()
    expect(screen.getByText('Tramo en curso')).toBeInTheDocument()

    const sinFallas: Disponibilidad = {
      ...base,
      cubetas: [base.cubetas[1]!],
      cortes: [],
      resumen: { ...base.resumen, interrupciones: 0, mayorCorteSegundos: 0 },
    }
    preparar({ ok: true, disponibilidad: sinFallas })
    await waitFor(() =>
      expect(screen.getAllByText('Llegaron lecturas')).toHaveLength(2),
    )
    expect(screen.getAllByText('Sin lecturas')).toHaveLength(1)
  })

  it('lista la interrupción en curso con su duración', async () => {
    preparar()
    expect(
      await screen.findByText('Interrupciones recientes'),
    ).toBeInTheDocument()
    expect(screen.getByText('Duración: 22 min')).toBeInTheDocument()
    expect(screen.getByText('En curso')).toBeInTheDocument()
    expect(screen.getByText(/a Ahora$/)).toBeInTheDocument()
  })

  it('sin interrupciones lo dice', async () => {
    preparar({
      ok: true,
      disponibilidad: {
        ...base,
        cortes: [],
        resumen: { ...base.resumen, interrupciones: 0, mayorCorteSegundos: 0 },
      },
    })
    expect(
      await screen.findByText('No hubo interrupciones en este periodo.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Ninguna')).toBeInTheDocument()
  })

  it('sin historia todavía explica qué esperar y no inventa un porcentaje', async () => {
    preparar({
      ok: true,
      disponibilidad: {
        ...base,
        cubetas: base.cubetas.map((c) => ({
          ...c,
          lecturas: 0,
          estado: 'sin_historial' as const,
        })),
        cortes: [],
        resumen: {
          porcentaje: null,
          cubetasEvaluadas: 0,
          cubetasConDatos: 0,
          interrupciones: 0,
          mayorCorteSegundos: 0,
        },
      },
    })
    expect(
      await screen.findByText(/Todavía no hay lecturas para calcular/),
    ).toBeInTheDocument()
    expect(screen.queryByText(/ %$/)).not.toBeInTheDocument()
    expect(
      screen.getByRole('img', {
        name: /todavía no hay lecturas para calcularla/,
      }),
    ).toBeInTheDocument()
  })

  it('al cambiar a 7 días pide esa ventana', async () => {
    const { props } = preparar()
    await screen.findByText('50 %')
    expect(
      screen.getByRole('button', { name: 'Últimas 24 h', pressed: true }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Últimos 7 días' }))

    await waitFor(() => expect(props.obtener).toHaveBeenCalledWith('7d'))
    expect(
      screen.getByRole('button', { name: 'Últimos 7 días', pressed: true }),
    ).toBeInTheDocument()
  })

  it('vuelve a pedir el historial cuando sube la recarga', async () => {
    const { props, rerender } = preparar()
    await screen.findByText('50 %')
    rerender(<HistorialDisponibilidad {...props} recarga={1} />)
    await waitFor(() => expect(props.obtener).toHaveBeenCalledTimes(2))
  })

  it('avisa si no se pudo cargar', async () => {
    preparar({ ok: false, motivo: 'fallo' })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo cargar el historial.',
    )
  })

  it('avisa a la app cuando la sesión caducó', async () => {
    const { props } = preparar({ ok: false, motivo: 'sesion' })
    await waitFor(() => expect(props.sesionCaducada).toHaveBeenCalledTimes(1))
  })

  it('explica cuánto dura cada barra', async () => {
    preparar()
    expect(
      await screen.findByText(/Cada barra es un tramo de 15 min/),
    ).toBeInTheDocument()
  })

  it('en inglés usa los textos ingleses', async () => {
    await i18n.changeLanguage('en')
    preparar()
    expect(await screen.findByText('Availability history')).toBeInTheDocument()
    expect(screen.getByText('Longest gap')).toBeInTheDocument()
    expect(screen.getByText('Ongoing')).toBeInTheDocument()
    expect(
      screen.getByRole('img', {
        name: 'Availability. Last 24 h: 50 %, 1 interruption.',
      }),
    ).toBeInTheDocument()
  })
})
