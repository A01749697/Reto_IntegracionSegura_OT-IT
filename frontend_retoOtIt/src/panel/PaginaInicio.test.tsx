import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Usuario } from '../login/apiPanel'
import PaginaInicio from './PaginaInicio'

const usuario: Usuario = {
  id: 2,
  nombre: 'Eduardo Serrano',
  correo: 'eduardo@ejemplo.com',
  rol: 'administrador',
}

describe('PaginaInicio', () => {
  it('muestra el nombre, el correo y el rol', () => {
    render(<PaginaInicio usuario={usuario} cerrarSesion={vi.fn()} />)
    expect(screen.getByText('Eduardo Serrano')).toBeInTheDocument()
    expect(screen.getByText('eduardo@ejemplo.com')).toBeInTheDocument()
    expect(screen.getByText('administrador')).toBeInTheDocument()
  })

  it('llama a cerrarSesion al pulsar el boton', async () => {
    const cerrarSesion = vi.fn().mockResolvedValue(true)
    render(<PaginaInicio usuario={usuario} cerrarSesion={cerrarSesion} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    await waitFor(() => expect(cerrarSesion).toHaveBeenCalledTimes(1))
  })

  it('avisa si no se pudo cerrar y deja intentar otra vez', async () => {
    const cerrarSesion = vi.fn().mockResolvedValue(false)
    render(<PaginaInicio usuario={usuario} cerrarSesion={cerrarSesion} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo cerrar la sesión',
    )
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeEnabled()
  })
})
