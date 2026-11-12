import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Usuario } from '../login/apiPanel'
import MenuUsuario from './MenuUsuario'

const USUARIO: Usuario = {
  id: 1,
  nombre: 'Ana Lugo',
  correo: 'ana@ejemplo.com',
  rol: 'administrador',
}

function montar(cerrar: () => Promise<boolean> = async () => true) {
  const props = {
    usuario: USUARIO,
    irAMiCuenta: vi.fn(),
    irAAyuda: vi.fn(),
    cerrarSesion: vi.fn(cerrar),
  }
  render(
    <>
      <button type="button">otro botón</button>
      <MenuUsuario {...props} />
    </>,
  )
  return props
}

const abrir = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Menú de Ana Lugo' }))

describe('MenuUsuario', () => {
  it('cerrado muestra el nombre, el rol y las iniciales, sin el menú', () => {
    montar()
    const boton = screen.getByRole('button', { name: 'Menú de Ana Lugo' })
    expect(boton).toHaveTextContent('AL')
    expect(boton).toHaveTextContent('Ana Lugo')
    expect(boton).toHaveTextContent('administrador')
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('al pulsarlo abre el menú con quién eres y sus opciones', () => {
    montar()
    abrir()
    expect(screen.getByRole('button', { name: /Menú de/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    const menu = screen.getByRole('menu')
    expect(menu).toHaveTextContent('ana@ejemplo.com')
    expect(
      screen.getAllByRole('menuitem').map((opcion) => opcion.textContent),
    ).toEqual(['Mi cuenta', 'IdiomaEspañol', 'Ayuda', 'Cerrar sesión'])
  })

  it('al abrir, el foco va a la primera opción', () => {
    montar()
    abrir()
    expect(screen.getByRole('menuitem', { name: 'Mi cuenta' })).toHaveFocus()
  })

  it('pulsar otra vez el botón lo cierra', () => {
    montar()
    abrir()
    abrir()
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('Idioma cambia a inglés sin cerrar el menú y vuelve a español', async () => {
    montar()
    abrir()
    fireEvent.click(
      screen.getByRole('menuitem', {
        name: 'Idioma: Español. Cambiar a English',
      }),
    )
    expect(
      await screen.findByRole('menuitem', {
        name: 'Language: English. Switch to Español',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeVisible()
    expect(document.documentElement.lang).toBe('en')
    expect(localStorage.getItem('idioma')).toBe('en')
    fireEvent.click(
      screen.getByRole('menuitem', {
        name: 'Language: English. Switch to Español',
      }),
    )
    expect(
      await screen.findByRole('menuitem', { name: 'Cerrar sesión' }),
    ).toBeVisible()
  })

  it('Mi cuenta y Ayuda avisan y cierran el menú', () => {
    const props = montar()
    abrir()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mi cuenta' }))
    expect(props.irAMiCuenta).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()

    abrir()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ayuda' }))
    expect(props.irAAyuda).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('Escape lo cierra y devuelve el foco al botón', () => {
    montar()
    abrir()
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Mi cuenta' }), {
      key: 'Escape',
    })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByRole('button', { name: /Menú de/ })).toHaveFocus()
  })

  it('un clic fuera lo cierra', () => {
    montar()
    abrir()
    fireEvent.mouseDown(screen.getByRole('button', { name: 'otro botón' }))
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('un clic dentro del menú no lo cierra', () => {
    montar()
    abrir()
    fireEvent.mouseDown(screen.getByRole('menu'))
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('Tab lo cierra', () => {
    montar()
    abrir()
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Mi cuenta' }), {
      key: 'Tab',
    })
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('las flechas recorren todas las opciones, también Idioma', () => {
    montar()
    abrir()
    const mover = (tecla: string) =>
      fireEvent.keyDown(document.activeElement as HTMLElement, { key: tecla })

    mover('ArrowDown')
    expect(screen.getByRole('menuitem', { name: /^Idioma/ })).toHaveFocus()
    mover('ArrowDown')
    expect(screen.getByRole('menuitem', { name: 'Ayuda' })).toHaveFocus()
    mover('ArrowDown')
    expect(
      screen.getByRole('menuitem', { name: 'Cerrar sesión' }),
    ).toHaveFocus()
    mover('ArrowDown')
    expect(screen.getByRole('menuitem', { name: 'Mi cuenta' })).toHaveFocus()
    mover('ArrowUp')
    expect(
      screen.getByRole('menuitem', { name: 'Cerrar sesión' }),
    ).toHaveFocus()
    mover('Home')
    expect(screen.getByRole('menuitem', { name: 'Mi cuenta' })).toHaveFocus()
    mover('End')
    expect(
      screen.getByRole('menuitem', { name: 'Cerrar sesión' }),
    ).toHaveFocus()
  })

  it('con el menú cerrado, la flecha hacia abajo lo abre', () => {
    montar()
    fireEvent.keyDown(screen.getByRole('button', { name: /Menú de/ }), {
      key: 'ArrowDown',
    })
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('Cerrar sesión la pide una sola vez aunque se pulse dos', async () => {
    let terminar: (ok: boolean) => void = () => {}
    const props = montar(() => new Promise<boolean>((r) => (terminar = r)))
    abrir()
    const opcion = screen.getByRole('menuitem', { name: 'Cerrar sesión' })
    fireEvent.click(opcion)
    fireEvent.click(opcion)
    expect(props.cerrarSesion).toHaveBeenCalledTimes(1)
    terminar(true)
  })

  it('si no se pudo cerrar la sesión, lo dice y deja volver a intentar', async () => {
    const props = montar(async () => false)
    abrir()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Cerrar sesión' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo cerrar la sesión',
    )
    await waitFor(() =>
      expect(
        screen.getByRole('menuitem', { name: 'Cerrar sesión' }),
      ).toBeEnabled(),
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'Cerrar sesión' }))
    await waitFor(() => expect(props.cerrarSesion).toHaveBeenCalledTimes(2))
  })
})
