import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import i18n from '../idioma/i18n'
import PaginaNoEncontrada from './PaginaNoEncontrada'

describe('PaginaNoEncontrada', () => {
  it('explica que la dirección no existe y ofrece volver', () => {
    const irAlInicio = vi.fn()
    render(<PaginaNoEncontrada irAlInicio={irAlInicio} />)
    expect(
      screen.getByRole('heading', { name: 'Página no encontrada' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ir al inicio' }))
    expect(irAlInicio).toHaveBeenCalledTimes(1)
  })

  it('también está en inglés', async () => {
    await i18n.changeLanguage('en')
    render(<PaginaNoEncontrada irAlInicio={vi.fn()} />)
    expect(
      screen.getByRole('heading', { name: 'Page not found' }),
    ).toBeInTheDocument()
  })
})
