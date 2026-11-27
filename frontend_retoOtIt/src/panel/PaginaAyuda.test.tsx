import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import i18n from '../idioma/i18n'
import PaginaAyuda from './PaginaAyuda'

describe('PaginaAyuda', () => {
  it('a un administrador le explica todas las pestañas', () => {
    render(<PaginaAyuda esAdmin />)
    expect(screen.getByRole('heading', { name: 'Ayuda' })).toBeInTheDocument()
    for (const nombre of [
      'Cuentas',
      'Bitácora',
      'Datos',
      'Estado',
      'Mi cuenta',
    ]) {
      expect(screen.getByText(nombre)).toBeInTheDocument()
    }
  })

  it('las pestañas salen en el mismo orden que en el encabezado', () => {
    const { container } = render(<PaginaAyuda esAdmin />)
    const nombres = [
      ...container.querySelectorAll('li > span:first-child'),
    ].map((n) => n.textContent)
    expect(nombres).toEqual([
      'Inicio',
      'Cuentas',
      'Bitácora',
      'Datos',
      'Estado',
      'Tablero',
      'Gemelo',
      'Mi cuenta',
    ])
  })

  it('a quien no es administrador no le habla de Cuentas, Bitácora ni Datos', () => {
    render(<PaginaAyuda esAdmin={false} />)
    expect(screen.getByText('Estado')).toBeInTheDocument()
    expect(screen.queryByText('Cuentas')).toBeNull()
    expect(screen.queryByText('Bitácora')).toBeNull()
    expect(screen.queryByText('Datos')).toBeNull()
  })

  it('responde lo de la cuenta bloqueada, la contraseña y la sesión', () => {
    render(<PaginaAyuda esAdmin={false} />)
    expect(screen.getByText('Mi cuenta se bloqueó')).toBeInTheDocument()
    expect(screen.getByText(/3 contraseñas incorrectas/)).toBeInTheDocument()
    expect(screen.getByText('Olvidé mi contraseña')).toBeInTheDocument()
    expect(screen.getByText(/30 minutos sin usar/)).toBeInTheDocument()
  })

  it('no da detalles internos de la red', () => {
    const { container } = render(<PaginaAyuda esAdmin />)
    expect(container.textContent).not.toMatch(
      /firewall|puerto|PLC|S7-|OPC|MQTT|IDMZ/i,
    )
  })
})

describe('PaginaAyuda en inglés', () => {
  it('muestra las pestañas y las preguntas en inglés', async () => {
    await i18n.changeLanguage('en')
    render(<PaginaAyuda esAdmin />)
    expect(screen.getByRole('heading', { name: 'Help' })).toBeInTheDocument()
    expect(screen.getByText('Accounts')).toBeInTheDocument()
    expect(screen.getByText('I forgot my password')).toBeInTheDocument()
  })
})
