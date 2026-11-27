import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../idioma/i18n'
import type { ResultadoLecturas, UltimaLectura } from './apiLecturas'
import { ESTADOS_TORRETA, NODOS } from './nodos'
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
  plc: string,
  variable: string,
  valor: number,
  ts = new Date().toISOString(),
): UltimaLectura => ({ plc, variable, valor, ts })

function lecturasDeAhora(verde = 1): ResultadoLecturas {
  return {
    ok: true,
    lecturas: [
      lectura(
        NODOS.torreta.plc,
        NODOS.torreta.nodo,
        verde ? ESTADOS_TORRETA.verde : ESTADOS_TORRETA.roja,
      ),
      lectura(NODOS.latido.plc, NODOS.latido.nodo, 77),
      lectura('S7-1500', 'TAB_PISTON_A', 1),
      lectura('S7-300', 'CONTADOR_PIEZAS', 12),
    ],
  }
}

function preparar(respuesta: ResultadoLecturas) {
  const props = {
    obtenerLecturas: vi.fn().mockResolvedValue(respuesta),
    obtenerHistorial: vi.fn().mockResolvedValue({ ok: true, puntos: [] }),
    obtenerCambios: vi
      .fn()
      .mockResolvedValue({ ok: true, cambios: [], truncado: false }),
    sesionCaducada: vi.fn(),
  }
  render(<PaginaGemelo {...props} />)
  return props
}

const elegir = (nombre: string) =>
  fireEvent.click(screen.getByRole('button', { name: nombre }))

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.useRealTimers())

describe('PaginaGemelo en vivo', () => {
  it('abre en vivo y muestra la torreta, el latido y los nodos de cada estación', async () => {
    preparar(lecturasDeAhora())
    expect(
      screen.getByRole('heading', { name: 'Gemelo digital' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Datos en vivo')).toBeInTheDocument()
    expect(screen.getByText('Verde: marcha')).toBeInTheDocument()
    // el latido sale en el resumen y en la lista del S7-1516
    expect(screen.getAllByText('77')).toHaveLength(2)
    expect(screen.getByText('TAB_PISTON_A')).toBeInTheDocument()
    expect(screen.getByText('CONTADOR_PIEZAS')).toBeInTheDocument()
    expect(screen.getByText(/S7-300 · garra/)).toBeInTheDocument()
    expect(screen.getByText(/Última lectura:/)).toBeInTheDocument()
  })

  it('la torreta real en verde pone la celda en marcha', async () => {
    preparar(lecturasDeAhora(1))
    const refrescar = await screen.findByRole('button', { name: 'vista 3D' })
    await screen.findByText('Verde: marcha')
    fireEvent.click(refrescar)
    expect(screen.getByText('Torreta verde: marcha')).toBeInTheDocument()
  })

  it('la torreta real en rojo deja la celda en paro', async () => {
    preparar(lecturasDeAhora(0))
    const refrescar = await screen.findByRole('button', { name: 'vista 3D' })
    expect(await screen.findByText('Roja: paro')).toBeInTheDocument()
    fireEvent.click(refrescar)
    expect(screen.getByText('Torreta roja: paro')).toBeInTheDocument()
    expect(
      screen.getByText('Torreta en rojo: pistones detenidos.'),
    ).toBeInTheDocument()
  })

  it.each([
    [2, 'Amarilla: mantenimiento', 'Torreta amarilla: mantenimiento'],
    [4, 'Amarilla parpadeando: reset', 'Torreta amarilla: reset'],
    [7, 'Estado 7: sin dato', 'Torreta sin dato'],
  ])('TAB_TORRETA %i se muestra como %s', async (valor, lectura, chip) => {
    const respuesta = lecturasDeAhora()
    if (respuesta.ok) respuesta.lecturas[0].valor = valor
    preparar(respuesta)
    const refrescar = await screen.findByRole('button', { name: 'vista 3D' })
    expect(await screen.findByText(lectura)).toBeInTheDocument()
    fireEvent.click(refrescar)
    expect(screen.getByText(chip)).toBeInTheDocument()
  })

  it('no ofrece botones de marcha, paro ni emergencia', async () => {
    preparar(lecturasDeAhora())
    await screen.findByText('Datos en vivo')
    for (const nombre of [
      'Marcha',
      'Paro',
      'Paro de emergencia',
      'Restablecer',
      'Verde (marcha)',
    ])
      expect(screen.queryByRole('button', { name: nombre })).toBeNull()
  })

  it('sin lecturas lo dice', async () => {
    preparar({ ok: true, lecturas: [] })
    expect(await screen.findByText('Sin lecturas todavía')).toBeInTheDocument()
    expect(screen.getByText('Sin lecturas todavía.')).toBeInTheDocument()
  })

  it('avisa si las lecturas están atrasadas', async () => {
    preparar({
      ok: true,
      lecturas: [lectura('S7-300', 'A', 5, '2026-01-01T00:00:00.000Z')],
    })
    expect(await screen.findByText('Lecturas atrasadas')).toBeInTheDocument()
  })

  it('avisa si no se pudo consultar', async () => {
    preparar({ ok: false, motivo: 'fallo' })
    expect(await screen.findByText('Sin conexión')).toBeInTheDocument()
    expect(screen.getByText(/Sin respuesta del panel/)).toBeInTheDocument()
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

  it('sigue a la torreta cuando cambia', async () => {
    vi.useFakeTimers()
    const props = preparar(lecturasDeAhora(1))
    await vi.advanceTimersByTimeAsync(100)
    props.obtenerLecturas.mockResolvedValue(lecturasDeAhora(0))
    await vi.advanceTimersByTimeAsync(5000)
    vi.useRealTimers()
    expect(await screen.findByText('Roja: paro')).toBeInTheDocument()
  })
})

describe('PaginaGemelo en simulación', () => {
  it('ofrece la torreta simulada en lugar de mandos y deja de consultar la nube', async () => {
    vi.useFakeTimers()
    const props = preparar(lecturasDeAhora())
    await vi.advanceTimersByTimeAsync(100)
    elegir('Simulación')
    expect(screen.getByText('Datos simulados')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Verde (marcha)' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: 'Roja (paro)' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Paro de emergencia' }),
    ).toBeNull()
    await vi.advanceTimersByTimeAsync(20_000)
    expect(props.obtenerLecturas).toHaveBeenCalledTimes(1)
  })

  it('la torreta en rojo detiene los pistones y lo dice', async () => {
    preparar(lecturasDeAhora())
    elegir('Simulación')
    const refrescar = await screen.findByRole('button', { name: 'vista 3D' })
    elegir('Roja (paro)')
    fireEvent.click(refrescar)
    expect(screen.getByText('Torreta roja: paro')).toBeInTheDocument()
    expect(
      screen.getByText('Torreta en rojo: pistones detenidos.'),
    ).toBeInTheDocument()
    elegir('Verde (marcha)')
    fireEvent.click(refrescar)
    expect(screen.getByText('Torreta verde: marcha')).toBeInTheDocument()
  })

  it('la torreta amarilla es mantenimiento: los pistones se detienen', async () => {
    preparar(lecturasDeAhora())
    elegir('Simulación')
    const refrescar = await screen.findByRole('button', { name: 'vista 3D' })
    elegir('Amarilla (mantenimiento)')
    fireEvent.click(refrescar)
    expect(
      screen.getByText('Torreta amarilla: mantenimiento'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Mantenimiento: arranque bloqueado.'),
    ).toBeInTheDocument()
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
      '1Alimentar2Identificar3Sujetar y marcar4Caer al depósito5Tomar6Clasificar7Empacar',
    )
  })

  it('marca la vista elegida', () => {
    preparar(lecturasDeAhora())
    expect(screen.getByRole('button', { name: 'General' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    elegir('Pórtico')
    expect(screen.getByRole('button', { name: 'Pórtico' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'General' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('en vivo la velocidad no se puede cambiar: va al ritmo de la celda', () => {
    preparar(lecturasDeAhora())
    expect(screen.getByRole('slider')).toBeDisabled()
    expect(screen.getByText(/ritmo de la celda/)).toBeInTheDocument()
  })

  it('en simulación deja cambiar la velocidad y ocultar las etiquetas', () => {
    preparar(lecturasDeAhora())
    elegir('Simulación')
    fireEvent.change(screen.getByRole('slider'), { target: { value: '2' } })
    expect(screen.getByText('2x')).toBeInTheDocument()
    const etiquetas = screen.getByRole('checkbox', {
      name: 'Etiquetas en la escena',
    })
    expect(etiquetas).toBeChecked()
    fireEvent.click(etiquetas)
    expect(etiquetas).not.toBeChecked()
  })

  it('las señales empiezan sin dato de la torreta y la garra en espera', () => {
    preparar(lecturasDeAhora())
    expect(screen.getByText('Torreta sin dato')).toBeInTheDocument()
    expect(screen.getByText('Garra en espera')).toBeInTheDocument()
    expect(screen.getByText('Alimentador atrás')).toBeInTheDocument()
    expect(screen.getByText('Pieza en el depósito')).toBeInTheDocument()
    expect(screen.getByText('Tope baja')).toBeInTheDocument()
    expect(screen.getAllByText('Sin pieza')).toHaveLength(2)
    expect(screen.getByText('6.00 bar')).toBeInTheDocument()
  })
})

describe('PaginaGemelo en inglés', () => {
  it('muestra la pantalla, las señales y los pasos en inglés', async () => {
    await i18n.changeLanguage('en')
    preparar(lecturasDeAhora())

    expect(
      screen.getByRole('heading', { name: 'Digital twin' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Live data')).toBeInTheDocument()
    expect(screen.getByText('Green: running')).toBeInTheDocument()
    expect(screen.getByText(/Last reading:/)).toBeInTheDocument()
    expect(screen.getByText('Feeder retracted')).toBeInTheDocument()
    expect(screen.getByText('Part in the hopper')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gantry' })).toBeInTheDocument()

    const pasos = screen.getByRole('list', { name: 'Process sequence' })
    expect(pasos.textContent).toBe(
      '1Feed2Identify3Clamp and mark4Drop into hopper5Pick6Sort7Pack',
    )
  })

  it('en simulación la torreta y el texto de ayuda salen en inglés', async () => {
    await i18n.changeLanguage('en')
    preparar(lecturasDeAhora())
    elegir('Simulation')

    expect(
      screen.getByRole('button', { name: 'Green (run)' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Red (stop)' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Simulated data')).toBeInTheDocument()
    expect(screen.getByText(/It only controls the pistons/)).toBeInTheDocument()
  })
})

describe('PaginaGemelo, alertas del tablero', () => {
  it('TORRETA_REAL todavía no llega: lo dice y no alerta', async () => {
    preparar(lecturasDeAhora())
    expect(await screen.findByText('Aún no se envía')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('si la torreta real no coincide con el tablero, alerta', async () => {
    const respuesta = lecturasDeAhora(1)
    if (respuesta.ok)
      respuesta.lecturas.push(
        lectura(
          NODOS.torretaReal.plc,
          NODOS.torretaReal.nodo,
          ESTADOS_TORRETA.roja,
        ),
      )
    preparar(respuesta)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Torreta real (Roja: paro) distinta al tablero (Verde: marcha).',
    )
  })

  it('si la torreta real no tiene una sola luz, alerta', async () => {
    const respuesta = lecturasDeAhora(1)
    if (respuesta.ok)
      respuesta.lecturas.push(
        lectura(NODOS.torretaReal.plc, NODOS.torretaReal.nodo, 0),
      )
    preparar(respuesta)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /ninguna luz o varias a la vez/,
    )
  })

  it('no alerta por el latido aunque no cambie (por ahora no se guarda)', async () => {
    vi.useFakeTimers()
    preparar(lecturasDeAhora(1)) // el latido se queda en 77
    await vi.advanceTimersByTimeAsync(30_000)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('muestra los contadores de piezas del S7-1516', async () => {
    const respuesta = lecturasDeAhora()
    if (respuesta.ok)
      respuesta.lecturas.push(
        lectura(NODOS.piezasAluminio.plc, NODOS.piezasAluminio.nodo, 52),
        lectura(NODOS.piezasOtras.plc, NODOS.piezasOtras.nodo, 250),
      )
    preparar(respuesta)
    expect(await screen.findByText('Piezas de aluminio')).toBeInTheDocument()
    expect(screen.getAllByText('52').length).toBeGreaterThan(0)
    expect(screen.getAllByText('250').length).toBeGreaterThan(0)
  })
})

describe('PaginaGemelo, pasos reales', () => {
  it('pide a /historial los cambios de TAB_PASO y muestra el paso más reciente', async () => {
    const respuesta = lecturasDeAhora()
    if (respuesta.ok)
      respuesta.lecturas.push(lectura(NODOS.paso.plc, NODOS.paso.nodo, 6))
    const props = preparar(respuesta)
    expect(await screen.findByText('6 · Sello de aluminio')).toBeInTheDocument()
    await waitFor(() => expect(props.obtenerHistorial).toHaveBeenCalled())
    const [plc, variable, desde, hasta] = props.obtenerHistorial.mock
      .calls[0] as [string, string, Date, Date]
    expect([plc, variable]).toEqual([NODOS.paso.plc, NODOS.paso.nodo])
    expect(desde.getTime()).toBeLessThan(hasta.getTime())
  })

  it('después de la primera, pide los cambios de cada estación cada segundo desde el último', async () => {
    vi.useFakeTimers()
    const props = preparar(lecturasDeAhora())
    props.obtenerHistorial.mockImplementation(async (_plc, nodo) => ({
      ok: true,
      puntos:
        nodo === 'TAB_PASO'
          ? [{ ts: '2026-11-24T20:00:05.000Z', valor: 2 }]
          : [],
    }))
    // la segunda vuelta del historial ya trae el paso; desde ahí, /lecturas/cambios
    await vi.advanceTimersByTimeAsync(3100)
    const llamada = props.obtenerCambios.mock.calls.find(
      (c) => c[0] === 'S7-1500',
    ) as [string, string[], Date]
    expect(llamada[1]).toContain('TAB_PASO')
    expect(llamada[1]).toContain('TAB_EMPUJA_EXT')
    expect(llamada[2].toISOString()).toBe('2026-11-24T20:00:05.000Z')
    await vi.advanceTimersByTimeAsync(3000)
    expect(
      props.obtenerCambios.mock.calls.filter((c) => c[0] === 'S7-1500').length,
    ).toBeGreaterThanOrEqual(3)
  })

  it('la primera consulta no depende del reloj: pide los cambios más recientes que haya', async () => {
    const props = preparar(lecturasDeAhora())
    await waitFor(() => expect(props.obtenerHistorial).toHaveBeenCalled())
    const desde = props.obtenerHistorial.mock.calls[0][2] as Date
    expect(desde.getTime()).toBe(0)
  })

  it('avisa cuando la celda lleva rato sin cambiar de paso', async () => {
    vi.useFakeTimers()
    const props = preparar(lecturasDeAhora())
    props.obtenerHistorial.mockResolvedValue({
      ok: true,
      puntos: [{ ts: '2026-11-24T20:00:05.000Z', valor: 8 }],
    })
    await vi.advanceTimersByTimeAsync(100)
    expect(
      screen.queryByText(/Sin cambios de paso desde/),
    ).not.toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(65_000)
    expect(screen.getByText(/Sin cambios de paso desde/)).toBeInTheDocument()
  })

  it('avisa si el historian no tiene ningún TAB_PASO', async () => {
    vi.useFakeTimers()
    preparar(lecturasDeAhora())
    await vi.advanceTimersByTimeAsync(65_000)
    expect(screen.getByText(/Sin registros de TAB_PASO/)).toBeInTheDocument()
  })

  it('en simulación no pide pasos reales', async () => {
    vi.useFakeTimers()
    const props = preparar(lecturasDeAhora())
    await vi.advanceTimersByTimeAsync(100)
    elegir('Simulación')
    const antes = props.obtenerHistorial.mock.calls.length
    await vi.advanceTimersByTimeAsync(20_000)
    expect(props.obtenerHistorial).toHaveBeenCalledTimes(antes)
  })
})
