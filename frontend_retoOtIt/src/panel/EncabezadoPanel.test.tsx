import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Usuario } from '../login/apiPanel'
import EncabezadoPanel, { type Seccion } from './EncabezadoPanel'

const ADMIN: Usuario = {
  id: 1,
  nombre: 'Ana Lugo',
  correo: 'ana@ejemplo.com',
  rol: 'administrador',
}
const USUARIO: Usuario = {
  ...ADMIN,
  id: 2,
  nombre: 'Iván Cortés',
  rol: 'usuario',
}

function montar(usuario: Usuario, actual: Seccion = 'inicio') {
  const props = {
    usuario,
    actual,
    irA: vi.fn(),
    cerrarSesion: vi.fn().mockResolvedValue(true),
  }
  render(<EncabezadoPanel {...props} />)
  return props
}

describe('EncabezadoPanel', () => {
  it('a un administrador le muestra todas las secciones', () => {
    montar(ADMIN)
    const nav = screen.getByRole('navigation', { name: 'Secciones' })
    expect(nav.textContent).toBe('InicioCuentasBitácoraEstadoMi cuenta')
  })

  it('a una persona sin rol de administrador no le muestra Cuentas ni Bitácora', () => {
    montar(USUARIO)
    expect(screen.queryByRole('button', { name: 'Cuentas' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Bitácora' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Estado' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Mi cuenta' }),
    ).toBeInTheDocument()
  })

  it('marca la sección actual', () => {
    montar(ADMIN, 'cuentas')
    expect(screen.getByRole('button', { name: 'Cuentas' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('button', { name: 'Inicio' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('al pulsar una sección avisa cuál es', () => {
    const props = montar(ADMIN)
    fireEvent.click(screen.getByRole('button', { name: 'Bitácora' }))
    expect(props.irA).toHaveBeenCalledWith('bitacora')
  })

  it('muestra quién tiene la sesión y su rol', () => {
    montar(ADMIN)
    expect(screen.getByText('Ana Lugo')).toBeInTheDocument()
    expect(screen.getByText('administrador')).toBeInTheDocument()
  })

  it('Salir cierra la sesión', () => {
    const props = montar(ADMIN)
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }))
    expect(props.cerrarSesion).toHaveBeenCalledTimes(1)
  })

  it('si no se pudo cerrar la sesión, lo dice y deja volver a intentar', async () => {
    const props = {
      usuario: ADMIN,
      actual: 'inicio' as const,
      irA: vi.fn(),
      cerrarSesion: vi.fn().mockResolvedValue(false),
    }
    render(<EncabezadoPanel {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo cerrar la sesión',
    )
    expect(screen.getByRole('button', { name: 'Salir' })).toBeEnabled()
  })

  it('trae el selector de modo claro y oscuro', () => {
    montar(ADMIN)
    expect(
      screen.getByRole('button', { name: /Cambiar a modo/ }),
    ).toBeInTheDocument()
  })
})
