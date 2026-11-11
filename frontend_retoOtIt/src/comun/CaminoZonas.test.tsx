import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import i18n from '../idioma/i18n'
import CaminoZonas from './CaminoZonas'

describe('CaminoZonas', () => {
  it.each(['grande', 'compacto'] as const)(
    'en tamaño %s nombra las cuatro zonas en orden',
    (tamano) => {
      render(<CaminoZonas tamano={tamano} />)
      const camino = screen.getByRole('img', { name: /Camino de los datos/ })
      const nombres = ['OT', 'IDMZ', 'IT', 'Nube']
      const texto = camino.textContent ?? ''
      let desde = 0
      for (const nombre of nombres) {
        const posicion = texto.indexOf(nombre, desde)
        expect(posicion).toBeGreaterThanOrEqual(desde)
        desde = posicion
      }
    },
  )

  it('dice dónde vive cada zona', () => {
    render(<CaminoZonas tamano="grande" />)
    expect(screen.getByText('Planta y PLC')).toBeInTheDocument()
    expect(screen.getByText('Servidor en AWS')).toBeInTheDocument()
  })
})

describe('CaminoZonas en inglés', () => {
  it('traduce la etiqueta y las zonas', async () => {
    await i18n.changeLanguage('en')
    render(<CaminoZonas tamano="grande" />)
    expect(screen.getByRole('img', { name: /Data path/ })).toBeInTheDocument()
    expect(screen.getByText('Cloud')).toBeInTheDocument()
    expect(screen.getByText('Plant and PLCs')).toBeInTheDocument()
    expect(screen.queryByText('Nube')).not.toBeInTheDocument()
  })
})
