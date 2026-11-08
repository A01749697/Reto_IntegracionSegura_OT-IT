import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Usuario } from '../login/apiPanel'
import PaginaInicio from './PaginaInicio'

const usuario: Usuario = {
  id: 2,
  nombre: 'Eduardo Serrano',
  correo: 'eduardo@ejemplo.com',
  rol: 'administrador',
}

describe('PaginaInicio', () => {
  it('lleva el título Inicio', () => {
    render(<PaginaInicio usuario={usuario} />)
    expect(screen.getByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
  })

  it('saluda y muestra el nombre, el correo y el rol', () => {
    render(<PaginaInicio usuario={usuario} />)
    expect(screen.getByText('Eduardo Serrano')).toBeInTheDocument()
    expect(screen.getByText('eduardo@ejemplo.com')).toBeInTheDocument()
    expect(screen.getByText('administrador')).toBeInTheDocument()
  })

  it('avisa que el dashboard todavía no está', () => {
    render(<PaginaInicio usuario={usuario} />)
    expect(screen.getByText(/Todavía no está el dashboard/)).toBeInTheDocument()
  })
})
