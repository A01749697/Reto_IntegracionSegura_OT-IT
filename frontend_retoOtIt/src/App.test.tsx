import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import * as api from './login/apiPanel'

vi.mock('./login/apiPanel', () => ({
  entrar: vi.fn(),
  crearCuenta: vi.fn(),
  pedirReinicio: vi.fn(),
  restablecer: vi.fn(),
  cerrarSesion: vi.fn(),
  obtenerSesion: vi.fn(),
}))

const usuario: api.Usuario = {
  id: 2,
  nombre: 'Eduardo Serrano',
  correo: 'eduardo@ejemplo.com',
  rol: 'administrador',
}

const codigo = 'ab12'.repeat(16)

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(api.obtenerSesion).mockResolvedValue(null)
  window.history.replaceState(null, '', '/')
})

describe('App', () => {
  it('muestra el login cuando no hay sesion', async () => {
    render(<App />)
    expect(
      await screen.findByRole('heading', { name: 'Panel Reto OT-IT' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Correo')).toBeInTheDocument()
  })

  it('muestra una pantalla de carga mientras revisa la sesion', async () => {
    render(<App />)
    expect(screen.getByRole('status')).toHaveTextContent('Cargando')
    await screen.findByLabelText('Correo')
  })

  it('muestra el panel cuando ya hay sesion', async () => {
    vi.mocked(api.obtenerSesion).mockResolvedValue(usuario)
    render(<App />)
    expect(
      await screen.findByRole('heading', { name: 'Sesión iniciada' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Eduardo Serrano')).toBeInTheDocument()
    expect(screen.getByText('administrador')).toBeInTheDocument()
  })

  it('pasa del login al panel al entrar', async () => {
    vi.mocked(api.entrar).mockResolvedValue({ ok: true, usuario })
    render(<App />)
    fireEvent.change(await screen.findByLabelText('Correo'), {
      target: { value: 'eduardo@ejemplo.com' },
    })
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'una-clave-larga-1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(
      await screen.findByRole('heading', { name: 'Sesión iniciada' }),
    ).toBeInTheDocument()
    expect(api.entrar).toHaveBeenCalledWith(
      'eduardo@ejemplo.com',
      'una-clave-larga-1',
    )
  })

  it('vuelve al login al cerrar la sesion', async () => {
    vi.mocked(api.obtenerSesion).mockResolvedValue(usuario)
    vi.mocked(api.cerrarSesion).mockResolvedValue(true)
    render(<App />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Cerrar sesión' }),
    )
    expect(await screen.findByLabelText('Correo')).toBeInTheDocument()
  })

  it('avisa y se queda en el panel si no se pudo cerrar la sesion', async () => {
    vi.mocked(api.obtenerSesion).mockResolvedValue(usuario)
    vi.mocked(api.cerrarSesion).mockResolvedValue(false)
    render(<App />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Cerrar sesión' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo cerrar la sesión',
    )
    expect(
      screen.getByRole('heading', { name: 'Sesión iniciada' }),
    ).toBeInTheDocument()
  })

  it('abre la contrasena nueva con el codigo del enlace y lo quita de la barra', async () => {
    vi.mocked(api.restablecer).mockResolvedValue({ ok: true })
    window.history.replaceState(null, '', `/#restablecer=${codigo}`)
    render(<App />)
    expect(
      await screen.findByRole('heading', { name: 'Contraseña nueva' }),
    ).toBeInTheDocument()
    expect(window.location.hash).toBe('')

    fireEvent.change(screen.getByLabelText('Contraseña nueva'), {
      target: { value: 'una-clave-larga-1' },
    })
    fireEvent.change(screen.getByLabelText('Repite la contraseña nueva'), {
      target: { value: 'una-clave-larga-1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))
    await waitFor(() =>
      expect(api.restablecer).toHaveBeenCalledWith(codigo, 'una-clave-larga-1'),
    )
  })

  it('ignora un enlace con el codigo mal formado', async () => {
    window.history.replaceState(null, '', '/#restablecer=corto')
    render(<App />)
    await screen.findByLabelText('Correo')
    expect(
      screen.queryByRole('heading', { name: 'Contraseña nueva' }),
    ).not.toBeInTheDocument()
  })
})
