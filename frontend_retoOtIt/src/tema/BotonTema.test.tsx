import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import BotonTema from './BotonTema'

afterEach(() => {
  delete document.documentElement.dataset.tema
  localStorage.clear()
})

describe('BotonTema', () => {
  it('en oscuro ofrece pasar a claro y lo hace', () => {
    document.documentElement.dataset.tema = 'oscuro'
    render(<BotonTema />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Cambiar a modo claro' }),
    )
    expect(document.documentElement.dataset.tema).toBe('claro')
    expect(localStorage.getItem('tema')).toBe('claro')
    expect(
      screen.getByRole('button', { name: 'Cambiar a modo oscuro' }),
    ).toBeInTheDocument()
  })

  it('en claro ofrece pasar a oscuro', () => {
    document.documentElement.dataset.tema = 'claro'
    render(<BotonTema />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Cambiar a modo oscuro' }),
    )
    expect(document.documentElement.dataset.tema).toBe('oscuro')
  })
})
