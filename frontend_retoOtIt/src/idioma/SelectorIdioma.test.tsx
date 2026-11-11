import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useTranslation } from 'react-i18next'
import { afterEach, describe, expect, it } from 'vitest'
import i18n from './i18n'
import SelectorIdioma from './SelectorIdioma'

afterEach(() => {
  document.documentElement.lang = 'es'
})

function Prueba() {
  const { t } = useTranslation()
  return (
    <>
      <SelectorIdioma />
      <p>{t('landing.titulo')}</p>
    </>
  )
}

describe('SelectorIdioma', () => {
  it('ofrece los dos idiomas y marca el activo', () => {
    render(<SelectorIdioma />)
    expect(screen.getByRole('group', { name: 'Idioma' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Español' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('al elegir inglés cambia los textos, la página y lo guarda', async () => {
    render(<Prueba />)
    expect(
      screen.getByText('Tus datos de planta, seguros hasta la nube'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'English' }))
    expect(
      await screen.findByText(
        'Your plant data, secure all the way to the cloud',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Language' })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('en')
    expect(localStorage.getItem('idioma')).toBe('en')
    expect(i18n.language).toBe('en')
  })

  it('se puede volver a español', async () => {
    render(<Prueba />)
    fireEvent.click(screen.getByRole('button', { name: 'English' }))
    await waitFor(() => expect(i18n.language).toBe('en'))
    fireEvent.click(screen.getByRole('button', { name: 'Español' }))
    expect(
      await screen.findByText('Tus datos de planta, seguros hasta la nube'),
    ).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('es')
    expect(localStorage.getItem('idioma')).toBe('es')
  })

  it('una clave que no existe no compila', () => {
    function Mala() {
      const { t } = useTranslation()
      // @ts-expect-error esta clave no existe en el diccionario
      return <p>{t('no.existe')}</p>
    }
    render(<Mala />)
  })
})
