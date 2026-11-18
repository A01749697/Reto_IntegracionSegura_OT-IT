import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PaginaLanding from './PaginaLanding'

function montar() {
  const props = { irLogin: vi.fn(), irCrear: vi.fn() }
  render(<PaginaLanding {...props} />)
  return props
}

describe('PaginaLanding', () => {
  it('dice de qué trata el panel', () => {
    montar()
    expect(
      screen.getByRole('heading', {
        name: 'Tus datos de planta, seguros hasta la nube',
      }),
    ).toBeInTheDocument()
  })

  it('Iniciar sesión lleva al login', () => {
    const props = montar()
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(props.irLogin).toHaveBeenCalledTimes(1)
    expect(props.irCrear).not.toHaveBeenCalled()
  })

  it('Crear cuenta lleva al formulario de solicitud', () => {
    const props = montar()
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    expect(props.irCrear).toHaveBeenCalledTimes(1)
    expect(props.irLogin).not.toHaveBeenCalled()
  })

  it('muestra el camino de las zonas y las tres funciones', () => {
    montar()
    expect(
      screen.getByRole('img', { name: /Camino de los datos/ }),
    ).toBeInTheDocument()
    expect(screen.getByText('Cuentas con aprobación')).toBeInTheDocument()
    expect(screen.getByText('Bitácora de seguridad')).toBeInTheDocument()
    expect(screen.getByText('Estado del sistema')).toBeInTheDocument()
  })

  it('no da detalles internos de la red', () => {
    montar()
    const texto = document.body.textContent ?? ''
    expect(texto).not.toMatch(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/)
    expect(texto).not.toMatch(/4840|5432|S7-1200|S7-1500|OPC UA|firewall/i)
  })
})

describe('PaginaLanding en inglés', () => {
  it('muestra todo en inglés y conserva los botones', async () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'English' }))
    expect(
      await screen.findByRole('heading', {
        name: 'Your plant data, secure all the way to the cloud',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Create account' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Security log')).toBeInTheDocument()
    expect(screen.queryByText('Bitácora de seguridad')).not.toBeInTheDocument()
  })
})
