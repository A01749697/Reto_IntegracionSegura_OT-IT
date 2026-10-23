import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('muestra el titulo del panel', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: 'Panel Reto OT-IT' }),
    ).toBeInTheDocument()
  })
})
