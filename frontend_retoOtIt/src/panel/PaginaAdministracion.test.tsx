import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Cuenta, FiltroCuentas } from './apiAdministracion'
import PaginaAdministracion from './PaginaAdministracion'

const ana: Cuenta = {
  id: 5,
  nombre: 'Ana Lopez',
  correo: 'ana@ejemplo.com',
  rol: 'usuario',
  estado: 'pendiente',
  bloqueada: false,
  creadoEn: '2026-10-30T15:00:00.000Z',
}
const jefe: Cuenta = {
  id: 2,
  nombre: 'Eduardo Serrano',
  correo: 'eduardo@ejemplo.com',
  rol: 'administrador',
  estado: 'aprobado',
  bloqueada: false,
  creadoEn: '2026-10-01T15:00:00.000Z',
}

function preparar(cuentasPorEstado: Partial<Record<FiltroCuentas, Cuenta[]>>) {
  const props = {
    listar: vi.fn(async (estado: FiltroCuentas) => ({
      ok: true as const,
      cuentas: cuentasPorEstado[estado] ?? [],
    })),
    decidir: vi.fn().mockResolvedValue({ ok: true }),
    desbloquear: vi.fn().mockResolvedValue({ ok: true }),
    hacerAdministrador: vi.fn().mockResolvedValue({ ok: true }),
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

  it('en aprobadas deja desactivar y en rechazadas reactivar', async () => {
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
      screen.getByRole('button', { name: 'Desactivar a Ana Lopez' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Rechazar a Ana Lopez' }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Rechazadas' }))
    await screen.findByText('Beto Ruiz')
    expect(
      screen.getByRole('button', { name: 'Reactivar a Beto Ruiz' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Aprobar a Beto Ruiz' }),
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
      desbloquear: vi.fn(),
      hacerAdministrador: vi.fn(),
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
      desbloquear: vi.fn(),
      hacerAdministrador: vi.fn(),
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

  it('desactiva y reactiva con su propio aviso', async () => {
    const props = preparar({
      aprobado: [{ ...ana, estado: 'aprobado' }],
      rechazado: [{ ...ana, estado: 'rechazado' }],
    })
    await screen.findByText('No hay cuentas pendientes.')
    fireEvent.click(screen.getByRole('button', { name: 'Aprobadas' }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'Desactivar a Ana Lopez' }),
    )
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Cuenta desactivada: Ana Lopez.',
      ),
    )
    expect(props.decidir).toHaveBeenLastCalledWith(5, 'rechazado')

    fireEvent.click(screen.getByRole('button', { name: 'Rechazadas' }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'Reactivar a Ana Lopez' }),
    )
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Cuenta reactivada: Ana Lopez.',
      ),
    )
    expect(props.decidir).toHaveBeenLastCalledWith(5, 'aprobado')
  })

  it('la lista Todas muestra el estado de cada cuenta', async () => {
    const props = preparar({
      todas: [
        { ...ana, estado: 'aprobado' },
        { ...ana, id: 6, nombre: 'Beto Ruiz' },
        jefe,
      ],
    })
    await screen.findByText('No hay cuentas pendientes.')
    fireEvent.click(screen.getByRole('button', { name: 'Todas' }))
    expect(await screen.findByText('Beto Ruiz')).toBeInTheDocument()
    expect(props.listar).toHaveBeenLastCalledWith('todas')
    expect(screen.getAllByText(/· Aprobada/)).toHaveLength(2)
    expect(screen.getByText(/· Pendiente/)).toBeInTheDocument()
    expect(screen.getByText(/· Administrador/)).toBeInTheDocument()
  })

  it('avisa cuando no hay ninguna cuenta en Todas', async () => {
    preparar({})
    await screen.findByText('No hay cuentas pendientes.')
    fireEvent.click(screen.getByRole('button', { name: 'Todas' }))
    expect(await screen.findByText('No hay cuentas.')).toBeInTheDocument()
  })

  it('marca las cuentas bloqueadas y las desbloquea', async () => {
    const props = preparar({
      aprobado: [{ ...ana, estado: 'aprobado', bloqueada: true }],
    })
    await screen.findByText('No hay cuentas pendientes.')
    fireEvent.click(screen.getByRole('button', { name: 'Aprobadas' }))
    expect(await screen.findByText('Bloqueada')).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Desbloquear a Ana Lopez' }),
    )
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Cuenta desbloqueada: Ana Lopez.',
      ),
    )
    expect(props.desbloquear).toHaveBeenCalledWith(5)
  })

  it('no ofrece desbloquear si la cuenta no está bloqueada', async () => {
    preparar({ aprobado: [{ ...ana, estado: 'aprobado' }] })
    await screen.findByText('No hay cuentas pendientes.')
    fireEvent.click(screen.getByRole('button', { name: 'Aprobadas' }))
    await screen.findByText('Ana Lopez')
    expect(screen.queryByText('Bloqueada')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Desbloquear/ }),
    ).not.toBeInTheDocument()
  })

  it('un administrador bloqueado también se puede desbloquear', async () => {
    const props = preparar({ aprobado: [{ ...jefe, bloqueada: true }] })
    await screen.findByText('No hay cuentas pendientes.')
    fireEvent.click(screen.getByRole('button', { name: 'Aprobadas' }))
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Desbloquear a Eduardo Serrano',
      }),
    )
    await waitFor(() => expect(props.desbloquear).toHaveBeenCalledWith(2))
  })

  it('hacer administrador pide confirmación antes de llamar', async () => {
    const props = preparar({ aprobado: [{ ...ana, estado: 'aprobado' }] })
    await screen.findByText('No hay cuentas pendientes.')
    fireEvent.click(screen.getByRole('button', { name: 'Aprobadas' }))
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Hacer administrador a Ana Lopez',
      }),
    )
    expect(props.hacerAdministrador).not.toHaveBeenCalled()
    expect(screen.getByText(/no se puede deshacer/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(props.hacerAdministrador).not.toHaveBeenCalled()
    expect(screen.queryByText(/no se puede deshacer/)).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Hacer administrador a Ana Lopez' }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Sí, hacer administrador' }),
    )
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Ana Lopez ahora es administrador.',
      ),
    )
    expect(props.hacerAdministrador).toHaveBeenCalledWith(5)
  })

  it('no ofrece hacer administrador a cuentas que no están aprobadas ni a administradores', async () => {
    preparar({ pendiente: [ana], aprobado: [jefe] })
    await screen.findByText('Ana Lopez')
    expect(
      screen.queryByRole('button', { name: /Hacer administrador/ }),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Aprobadas' }))
    await screen.findByText('Eduardo Serrano')
    expect(
      screen.queryByRole('button', { name: /Hacer administrador/ }),
    ).not.toBeInTheDocument()
  })

  it('si falla hacer administrador muestra el aviso y cierra la confirmación', async () => {
    const props = preparar({ aprobado: [{ ...ana, estado: 'aprobado' }] })
    props.hacerAdministrador.mockResolvedValue({ ok: false, motivo: 'fallo' })
    await screen.findByText('No hay cuentas pendientes.')
    fireEvent.click(screen.getByRole('button', { name: 'Aprobadas' }))
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Hacer administrador a Ana Lopez',
      }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Sí, hacer administrador' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo completar',
    )
    expect(screen.queryByText(/no se puede deshacer/)).not.toBeInTheDocument()
  })

  it('avisa a la app si la sesión caducó al desbloquear', async () => {
    const props = preparar({
      aprobado: [{ ...ana, estado: 'aprobado', bloqueada: true }],
    })
    props.desbloquear.mockResolvedValue({ ok: false, motivo: 'sesion' })
    await screen.findByText('No hay cuentas pendientes.')
    fireEvent.click(screen.getByRole('button', { name: 'Aprobadas' }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'Desbloquear a Ana Lopez' }),
    )
    await waitFor(() => expect(props.sesionCaducada).toHaveBeenCalledTimes(1))
  })
})
