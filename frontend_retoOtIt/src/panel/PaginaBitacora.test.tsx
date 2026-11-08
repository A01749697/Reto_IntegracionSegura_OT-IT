import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  EventoBitacora,
  GrupoBitacora,
  ResultadoBitacora,
  ResultadoExportar,
} from './apiBitacora'
import PaginaBitacora from './PaginaBitacora'

function evento(id: number, cambios: Partial<EventoBitacora> = {}) {
  return {
    id,
    ocurrioEn: '2026-11-06T18:00:00.000Z',
    tipo: 'entrada_correcta',
    usuarioId: 1,
    correo: `persona${id}@ejemplo.com`,
    ip: '203.0.113.7',
    actorCorreo: null,
    ...cambios,
  }
}

function preparar(respuesta: ResultadoBitacora) {
  const props = {
    listar: vi
      .fn<(g: GrupoBitacora, a?: number) => Promise<ResultadoBitacora>>()
      .mockResolvedValue(respuesta),
    exportar: vi
      .fn<(g: GrupoBitacora) => Promise<ResultadoExportar>>()
      .mockResolvedValue({
        ok: true,
        archivo: new Blob(['id\r\n']),
        truncado: false,
      }),
    descargar: vi.fn(),
    volver: vi.fn(),
    sesionCaducada: vi.fn(),
  }
  render(<PaginaBitacora {...props} />)
  return props
}

beforeEach(() => vi.clearAllMocks())

describe('PaginaBitacora', () => {
  it('muestra los eventos con su descripción, correo e IP', async () => {
    const props = preparar({
      ok: true,
      eventos: [evento(2), evento(1, { tipo: 'sesion_cerrada' })],
      hayMas: false,
    })
    expect(await screen.findByText('Inició sesión')).toBeInTheDocument()
    expect(screen.getByText('Cerró sesión')).toBeInTheDocument()
    expect(screen.getByText(/persona2@ejemplo.com/)).toBeInTheDocument()
    expect(screen.getAllByText(/203.0.113.7/)).toHaveLength(2)
    expect(props.listar).toHaveBeenCalledWith('todos')
  })

  it('marca como alerta solo los eventos de riesgo', async () => {
    preparar({
      ok: true,
      eventos: [
        evento(2, { tipo: 'entrada_fallida' }),
        evento(1, { tipo: 'entrada_correcta' }),
      ],
      hayMas: false,
    })
    await screen.findByText('Intento de entrada con datos incorrectos')
    expect(screen.getAllByText('Alerta')).toHaveLength(1)
  })

  it('en aprobaciones dice quién la decidió', async () => {
    preparar({
      ok: true,
      eventos: [
        evento(1, { tipo: 'cuenta_aprobada', actorCorreo: 'jefe@ejemplo.com' }),
      ],
      hayMas: false,
    })
    expect(
      await screen.findByText('Cuenta aprobada por jefe@ejemplo.com'),
    ).toBeInTheDocument()
  })

  it('muestra el tipo tal cual si esta versión no lo conoce', async () => {
    preparar({
      ok: true,
      eventos: [evento(1, { tipo: 'tipo_nuevo', correo: null, ip: null })],
      hayMas: false,
    })
    expect(await screen.findByText('tipo_nuevo')).toBeInTheDocument()
    expect(screen.getByText('Sin correo · Sin IP')).toBeInTheDocument()
  })

  it('avisa cuando no hay eventos', async () => {
    preparar({ ok: true, eventos: [], hayMas: false })
    expect(
      await screen.findByText('Todavía no hay eventos registrados.'),
    ).toBeInTheDocument()
  })

  it('cambia a alertas con el filtro', async () => {
    const props = preparar({ ok: true, eventos: [], hayMas: false })
    await screen.findByText('Todavía no hay eventos registrados.')
    fireEvent.click(screen.getByRole('button', { name: 'Alertas' }))
    expect(await screen.findByText('No hay alertas registradas.')).toBeVisible()
    expect(props.listar).toHaveBeenLastCalledWith('alertas')
    expect(screen.getByRole('button', { name: 'Alertas' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('carga más eventos a partir del último y los agrega', async () => {
    const props = preparar({
      ok: true,
      eventos: [evento(3), evento(2)],
      hayMas: true,
    })
    props.listar.mockResolvedValueOnce({
      ok: true,
      eventos: [evento(1)],
      hayMas: false,
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Cargar más' }))
    expect(await screen.findByText(/persona1@ejemplo.com/)).toBeInTheDocument()
    expect(screen.getByText(/persona3@ejemplo.com/)).toBeInTheDocument()
    expect(props.listar).toHaveBeenLastCalledWith('todos', 2)
    expect(
      screen.queryByRole('button', { name: 'Cargar más' }),
    ).not.toBeInTheDocument()
  })

  it('avisa si falla cargar más y conserva lo que ya se veía', async () => {
    const props = preparar({
      ok: true,
      eventos: [evento(3)],
      hayMas: true,
    })
    props.listar.mockResolvedValueOnce({ ok: false, motivo: 'fallo' })
    fireEvent.click(await screen.findByRole('button', { name: 'Cargar más' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudieron cargar más eventos',
    )
    expect(screen.getByText(/persona3@ejemplo.com/)).toBeInTheDocument()
  })

  it('vuelve a pedir la primera página con Actualizar', async () => {
    const props = preparar({ ok: true, eventos: [evento(1)], hayMas: false })
    await screen.findByText(/persona1@ejemplo.com/)
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    await waitFor(() => expect(props.listar).toHaveBeenCalledTimes(2))
    expect(props.listar).toHaveBeenLastCalledWith('todos')
  })

  it('avisa si no se pudo cargar la bitácora', async () => {
    preparar({ ok: false, motivo: 'fallo' })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo cargar la bitácora',
    )
  })

  it('avisa a la app cuando la sesión caducó', async () => {
    const props = preparar({ ok: false, motivo: 'sesion' })
    await waitFor(() => expect(props.sesionCaducada).toHaveBeenCalledTimes(1))
  })

  it('vuelve al inicio con el botón Volver', async () => {
    const props = preparar({ ok: true, eventos: [], hayMas: false })
    await screen.findByText('Todavía no hay eventos registrados.')
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
    expect(props.volver).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['cuenta_desbloqueada', 'Cuenta desbloqueada'],
    ['rol_cambiado', 'Cuenta promovida a administrador'],
    ['contrasena_cambiada', 'Cambió su contraseña desde Mi cuenta'],
    ['bitacora_exportada', 'Descargó la bitácora en CSV'],
  ])('describe el evento %s sin marcarlo como alerta', async (tipo, texto) => {
    preparar({ ok: true, eventos: [evento(1, { tipo })], hayMas: false })
    expect(await screen.findByText(texto)).toBeInTheDocument()
    expect(screen.queryByText('Alerta')).not.toBeInTheDocument()
  })

  it('marca como alerta el cambio de contraseña con la actual incorrecta', async () => {
    preparar({
      ok: true,
      eventos: [evento(1, { tipo: 'cambio_contrasena_fallido' })],
      hayMas: false,
    })
    expect(
      await screen.findByText(
        'Intentó cambiar su contraseña con la actual incorrecta',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Alerta')).toBeInTheDocument()
  })

  describe('descargar CSV', () => {
    it('pide el archivo del filtro activo y lo entrega al navegador', async () => {
      const props = preparar({ ok: true, eventos: [], hayMas: false })
      await screen.findByText('Todavía no hay eventos registrados.')
      fireEvent.click(screen.getByRole('button', { name: 'Alertas' }))
      await screen.findByText('No hay alertas registradas.')

      fireEvent.click(screen.getByRole('button', { name: 'Descargar CSV' }))

      await waitFor(() => expect(props.descargar).toHaveBeenCalledTimes(1))
      expect(props.exportar).toHaveBeenCalledWith('alertas')
      expect(props.descargar.mock.calls[0]?.[0]).toMatch(
        /^bitacora-alertas-\d{4}-\d{2}-\d{2}\.csv$/,
      )
      expect(screen.getByRole('status')).toHaveTextContent(
        'Archivo descargado.',
      )
    })

    it('si el archivo quedó recortado lo dice', async () => {
      const props = preparar({ ok: true, eventos: [], hayMas: false })
      props.exportar.mockResolvedValue({
        ok: true,
        archivo: new Blob(['x']),
        truncado: true,
      })
      await screen.findByText('Todavía no hay eventos registrados.')
      fireEvent.click(screen.getByRole('button', { name: 'Descargar CSV' }))
      expect(await screen.findByRole('status')).toHaveTextContent(
        'Solo incluye los 5000 eventos más recientes',
      )
      expect(props.descargar.mock.calls[0]?.[0]).toMatch(/^bitacora-\d{4}/)
    })

    it('avisa si no se pudo descargar y no entrega nada', async () => {
      const props = preparar({ ok: true, eventos: [], hayMas: false })
      props.exportar.mockResolvedValue({ ok: false, motivo: 'fallo' })
      await screen.findByText('Todavía no hay eventos registrados.')
      fireEvent.click(screen.getByRole('button', { name: 'Descargar CSV' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'No se pudo descargar el archivo',
      )
      expect(props.descargar).not.toHaveBeenCalled()
    })

    it('avisa a la app si la sesión caducó al descargar', async () => {
      const props = preparar({ ok: true, eventos: [], hayMas: false })
      props.exportar.mockResolvedValue({ ok: false, motivo: 'sesion' })
      await screen.findByText('Todavía no hay eventos registrados.')
      fireEvent.click(screen.getByRole('button', { name: 'Descargar CSV' }))
      await waitFor(() => expect(props.sesionCaducada).toHaveBeenCalledTimes(1))
    })
  })
})
