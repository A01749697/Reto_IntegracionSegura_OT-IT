import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Cuenta, EstadoCuenta } from './apiAdministracion'
import PaginaAdministracion from './PaginaAdministracion'

const ana: Cuenta = {
  id: 5,
  nombre: 'Ana Lopez',
  correo: 'ana@ejemplo.com',
  rol: 'usuario',
  estado: 'pendiente',
  creadoEn: '2026-10-30T15:00:00.000Z',
}
const jefe: Cuenta = {
  id: 2,
  nombre: 'Eduardo Serrano',
  correo: 'eduardo@ejemplo.com',
  rol: 'administrador',
  estado: 'aprobado',
  creadoEn: '2026-10-01T15:00:00.000Z',
}

function preparar(cuentasPorEstado: Partial<Record<EstadoCuenta, Cuenta[]>>) {
  const props = {
    listar: vi.fn(async (estado: EstadoCuenta) => ({
      ok: true as const,
      cuentas: cuentasPorEstado[estado] ?? [],
    })),
    decidir: vi.fn().mockResolvedValue({ ok: true }),
    volver: vi.fn(),
    sesionCaducada: vi.fn(),
  }
  render(<PaginaAdministracion {...props} />)
  return props
}

beforeEach(() => vi.clearAllMocks())

describe('PaginaAdministracion', () => {
  it('muestra las cuentas pendientes al abrir', async () => {
    const props = preparar({ pendiente: [ana] })
    expect(await screen.findByText('Ana Lopez')).toBeInTheDocument()
    expect(screen.getByText('ana@ejemplo.com')).toBeInTheDocument()
    expect(props.listar).toHaveBeenCalledWith('pendiente')
    expect(
      screen.getByRole('button', { name: 'Aprobar a Ana Lopez' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Rechazar a Ana Lopez' }),
    ).toBeInTheDocument()
  })

  it('avisa cuando no hay cuentas en la lista', async () => {
    preparar({})
    expect(
      await screen.findByText('No hay cuentas pendientes.'),
    ).toBeInTheDocument()
  })

  it('cambia de lista con los filtros', async () => {
    const props = preparar({ aprobado: [jefe] })
    await screen.findByText('No hay cuentas pendientes.')
    fireEvent.click(screen.getByRole('button', { name: 'Aprobadas' }))
    expect(await screen.findByText('Eduardo Serrano')).toBeInTheDocument()
    expect(props.listar).toHaveBeenCalledWith('aprobado')
  })

  it('no ofrece decidir sobre cuentas de administrador', async () => {
    preparar({ aprobado: [jefe] })
    await screen.findByText('No hay cuentas pendientes.')
    fireEvent.click(screen.getByRole('button', { name: 'Aprobadas' }))
    await screen.findByText('Eduardo Serrano')
    expect(
      screen.queryByRole('button', { name: /Rechazar a/ }),
    ).not.toBeInTheDocument()
  })

  it('en aprobadas solo deja rechazar y en rechazadas solo aprobar', async () => {
    preparar({
      aprobado: [{ ...ana, estado: 'aprobado' }],
      rechazado: [{ ...ana, id: 6, nombre: 'Beto Ruiz', estado: 'rechazado' }],
    })
    await screen.findByText('No hay cuentas pendientes.')
    fireEvent.click(screen.getByRole('button', { name: 'Aprobadas' }))
    await screen.findByText('Ana Lopez')
    expect(
      screen.queryByRole('button', { name: 'Aprobar a Ana Lopez' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Rechazar a Ana Lopez' }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Rechazadas' }))
    await screen.findByText('Beto Ruiz')
    expect(
      screen.getByRole('button', { name: 'Aprobar a Beto Ruiz' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Rechazar a Beto Ruiz' }),
    ).not.toBeInTheDocument()
  })

  it('aprueba una cuenta, avisa y recarga la lista', async () => {
    const props = preparar({ pendiente: [ana] })
    const boton = await screen.findByRole('button', {
      name: 'Aprobar a Ana Lopez',
    })
    props.listar.mockResolvedValueOnce({ ok: true, cuentas: [] })
    fireEvent.click(boton)
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Cuenta aprobada: Ana Lopez.',
      ),
    )
    expect(props.decidir).toHaveBeenCalledWith(5, 'aprobado')
    expect(await screen.findByText('No hay cuentas pendientes.')).toBeVisible()
  })

  it('rechaza una cuenta y avisa', async () => {
    const props = preparar({ pendiente: [ana] })
    fireEvent.click(
      await screen.findByRole('button', { name: 'Rechazar a Ana Lopez' }),
    )
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Cuenta rechazada: Ana Lopez.',
      ),
    )
    expect(props.decidir).toHaveBeenCalledWith(5, 'rechazado')
  })

  it.each([
    ['no_existe', 'La cuenta ya no existe.'],
    ['no_permitido', 'no se puede cambiar desde el panel'],
    ['sin_cambio', 'ya tenía ese estado'],
    ['fallo', 'No se pudo completar'],
  ] as const)(
    'muestra el aviso cuando el motivo es %s',
    async (motivo, texto) => {
      const props = preparar({ pendiente: [ana] })
      props.decidir.mockResolvedValue({ ok: false, motivo })
      fireEvent.click(
        await screen.findByRole('button', { name: 'Aprobar a Ana Lopez' }),
      )
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(texto),
      )
    },
  )

  it('avisa si no se pudo cargar la lista', async () => {
    const props = {
      listar: vi.fn().mockResolvedValue({ ok: false, motivo: 'fallo' }),
      decidir: vi.fn(),
      volver: vi.fn(),
      sesionCaducada: vi.fn(),
    }
    render(<PaginaAdministracion {...props} />)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo cargar la lista.',
    )
  })

  it('avisa a la app cuando la sesion caduco al listar', async () => {
    const props = {
      listar: vi.fn().mockResolvedValue({ ok: false, motivo: 'sesion' }),
      decidir: vi.fn(),
      volver: vi.fn(),
      sesionCaducada: vi.fn(),
    }
    render(<PaginaAdministracion {...props} />)
    await waitFor(() => expect(props.sesionCaducada).toHaveBeenCalledTimes(1))
  })

  it('avisa a la app cuando la sesion caduco al decidir', async () => {
    const props = preparar({ pendiente: [ana] })
    props.decidir.mockResolvedValue({ ok: false, motivo: 'sesion' })
    fireEvent.click(
      await screen.findByRole('button', { name: 'Aprobar a Ana Lopez' }),
    )
    await waitFor(() => expect(props.sesionCaducada).toHaveBeenCalledTimes(1))
  })

  it('vuelve al inicio con el boton Volver', async () => {
    const props = preparar({})
    await screen.findByText('No hay cuentas pendientes.')
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
    expect(props.volver).toHaveBeenCalledTimes(1)
  })
})
