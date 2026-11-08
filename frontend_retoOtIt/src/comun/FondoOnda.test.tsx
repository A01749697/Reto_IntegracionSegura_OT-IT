import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import FondoOnda from './FondoOnda'

describe('FondoOnda', () => {
  it('es solo decoración: oculto para lectores de pantalla y sin recibir clics', () => {
    const { container } = render(<FondoOnda />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg?.getAttribute('class')).toContain('pointer-events-none')
  })

  it('dibuja las líneas normales y las de acento', () => {
    const { container } = render(<FondoOnda />)
    const trazos = container.querySelectorAll('path')
    expect(trazos).toHaveLength(2)
    for (const trazo of trazos) {
      expect(trazo.getAttribute('d')?.startsWith('M')).toBe(true)
    }
  })
})
