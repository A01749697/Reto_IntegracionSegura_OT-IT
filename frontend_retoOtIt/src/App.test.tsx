import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import * as api from './login/apiPanel'
import * as admin from './panel/apiAdministracion'
import * as bitacora from './panel/apiBitacora'
import * as cuenta from './panel/apiCuenta'
import * as datos from './panel/apiDatos'
import * as sistema from './panel/apiSistema'

vi.mock('./login/apiPanel', () => ({
  entrar: vi.fn(),
  crearCuenta: vi.fn(),
  pedirReinicio: vi.fn(),
  restablecer: vi.fn(),
  cerrarSesion: vi.fn(),
  obtenerSesion: vi.fn(),
}))

vi.mock('./panel/apiAdministracion', () => ({
  listarCuentas: vi.fn(),
  decidirCuenta: vi.fn(),
  desbloquearCuenta: vi.fn(),
  hacerAdministrador: vi.fn(),
}))

vi.mock('./panel/apiBitacora', () => ({
  listarBitacora: vi.fn(),
  exportarBitacora: vi.fn(),
}))

vi.mock('./panel/apiCuenta', () => ({
  cambiarContrasena: vi.fn(),
}))

vi.mock('./panel/apiDatos', () => ({
  listarTablas: vi.fn(),
  leerDatos: vi.fn(),
}))

vi.mock('./panel/apiSistema', () => ({
  obtenerEstado: vi.fn(),
}))

const usuario: api.Usuario = {
  id: 2,
  nombre: 'Eduardo Serrano',
  correo: 'eduardo@ejemplo.com',
  rol: 'administrador',
}

const codigo = 'ab12'.repeat(16)

const TITULO_LANDING = 'Tus datos de planta, seguros hasta la nube'

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(api.obtenerSesion).mockResolvedValue(null)
  window.history.replaceState(null, '', '/')
})

// Sin sesion se ve la landing; esto avanza hasta el formulario de entrada.
async function irAlLogin() {
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Iniciar sesión' }))
  return screen.findByLabelText('Correo')
}

const irA = (nombre: string) =>
  fireEvent.click(screen.getByRole('button', { name: nombre }))

describe('App sin sesión', () => {
  it('muestra la página de inicio cuando no hay sesión', async () => {
    render(<App />)
    expect(
      await screen.findByRole('heading', { name: TITULO_LANDING }),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Correo')).not.toBeInTheDocument()
  })

  it('muestra una pantalla de carga mientras revisa la sesion', async () => {
    render(<App />)
    expect(screen.getByRole('status')).toHaveTextContent('Cargando')
    await screen.findByRole('heading', { name: TITULO_LANDING })
  })

  it('Iniciar sesión lleva al formulario de entrada', async () => {
    await irAlLogin()
    expect(
      screen.getByRole('heading', { name: 'Entrar al panel' }),
    ).toBeInTheDocument()
  })

  it('Crear cuenta lleva directo al formulario de solicitud', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Crear cuenta' }))
    expect(
      await screen.findByRole('heading', { name: 'Crear cuenta' }),
    ).toBeInTheDocument()
  })

  it('desde el login se puede volver a la página de inicio', async () => {
    await irAlLogin()
    irA('Panel Reto OT-IT, ir al inicio')
    expect(
      await screen.findByRole('heading', { name: TITULO_LANDING }),
    ).toBeInTheDocument()
  })

  it('pasa del login al panel al entrar', async () => {
    vi.mocked(api.entrar).mockResolvedValue({ ok: true, usuario })
    fireEvent.change(await irAlLogin(), {
      target: { value: 'eduardo@ejemplo.com' },
    })
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'una-clave-larga-1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(
      await screen.findByRole('heading', { name: 'Inicio' }),
    ).toBeInTheDocument()
    expect(api.entrar).toHaveBeenCalledWith(
      'eduardo@ejemplo.com',
      'una-clave-larga-1',
    )
  })

  it('abre la contrasena nueva con el codigo del enlace sin pasar por la página de inicio', async () => {
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
    expect(
      await screen.findByRole('heading', { name: TITULO_LANDING }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Contraseña nueva' }),
    ).not.toBeInTheDocument()
  })
})

describe('App con sesión', () => {
  it('muestra el inicio con el encabezado y los datos de la sesión', async () => {
    vi.mocked(api.obtenerSesion).mockResolvedValue(usuario)
    render(<App />)
    expect(
      await screen.findByRole('heading', { name: 'Inicio' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('navigation', { name: 'Secciones' }),
    ).toBeInTheDocument()
    expect(screen.getByText('eduardo@ejemplo.com')).toBeInTheDocument()
    expect(screen.getAllByText('Eduardo Serrano').length).toBeGreaterThan(0)
  })

  it('Cerrar sesión cierra la sesión y vuelve a la página de inicio', async () => {
    vi.mocked(api.obtenerSesion).mockResolvedValue(usuario)
    vi.mocked(api.cerrarSesion).mockResolvedValue(true)
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /Menú de/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Cerrar sesión' }))
    expect(
      await screen.findByRole('heading', { name: TITULO_LANDING }),
    ).toBeInTheDocument()
  })

  it('avisa y se queda en el panel si no se pudo cerrar la sesion', async () => {
    vi.mocked(api.obtenerSesion).mockResolvedValue(usuario)
    vi.mocked(api.cerrarSesion).mockResolvedValue(false)
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /Menú de/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Cerrar sesión' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo cerrar la sesión',
    )
    expect(screen.getByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
  })

  it('desde el menú de la cuenta se llega a Mi cuenta y a Ayuda', async () => {
    vi.mocked(api.obtenerSesion).mockResolvedValue(usuario)
    render(<App />)
    await screen.findByRole('heading', { name: 'Inicio' })

    fireEvent.click(screen.getByRole('button', { name: /Menú de/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ayuda' }))
    expect(
      await screen.findByRole('heading', { name: 'Ayuda' }),
    ).toBeInTheDocument()
    // el menú se cierra al elegir
    expect(screen.queryByRole('menu')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Menú de/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mi cuenta' }))
    expect(
      await screen.findByRole('heading', { name: 'Mi cuenta' }),
    ).toBeInTheDocument()
  })

  it('navega a Cuentas y de regreso a Inicio con las pestañas', async () => {
    vi.mocked(api.obtenerSesion).mockResolvedValue(usuario)
    vi.mocked(admin.listarCuentas).mockResolvedValue({ ok: true, cuentas: [] })
    render(<App />)
    await screen.findByRole('heading', { name: 'Inicio' })
    irA('Cuentas')
    expect(
      await screen.findByRole('heading', { name: 'Cuentas' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cuentas' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    irA('Inicio')
    expect(
      await screen.findByRole('heading', { name: 'Inicio' }),
    ).toBeInTheDocument()
  })

  it('manda al login si la sesion caduca en la pantalla de cuentas', async () => {
    vi.mocked(api.obtenerSesion).mockResolvedValue(usuario)
    vi.mocked(admin.listarCuentas).mockResolvedValue({
      ok: false,
      motivo: 'sesion',
    })
    render(<App />)
    await screen.findByRole('heading', { name: 'Inicio' })
    irA('Cuentas')
    expect(await screen.findByLabelText('Correo')).toBeInTheDocument()
  })

  it('a quien no es administrador no le muestra Cuentas ni Bitácora', async () => {
    vi.mocked(api.obtenerSesion).mockResolvedValue({
      ...usuario,
      rol: 'usuario',
    })
    render(<App />)
    await screen.findByRole('heading', { name: 'Inicio' })
    expect(
      screen.queryByRole('button', { name: 'Cuentas' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Bitácora' }),
    ).not.toBeInTheDocument()
  })

  it('abre la bitácora y vuelve al inicio', async () => {
    vi.mocked(api.obtenerSesion).mockResolvedValue(usuario)
    vi.mocked(bitacora.listarBitacora).mockResolvedValue({
      ok: true,
      eventos: [],
      hayMas: false,
    })
    render(<App />)
    await screen.findByRole('heading', { name: 'Inicio' })
    irA('Bitácora')
    expect(
      await screen.findByRole('heading', { name: 'Bitácora de seguridad' }),
    ).toBeInTheDocument()
    irA('Inicio')
    expect(
      await screen.findByRole('heading', { name: 'Inicio' }),
    ).toBeInTheDocument()
  })

  it('abre Datos y muestra una tabla', async () => {
    vi.mocked(api.obtenerSesion).mockResolvedValue(usuario)
    vi.mocked(datos.listarTablas).mockResolvedValue({
      ok: true,
      tablas: [{ id: 'cuentas', nombre: 'Cuentas' }],
    })
    vi.mocked(datos.leerDatos).mockResolvedValue({
      ok: true,
      columnas: [{ clave: 'nombre', titulo: 'nombre' }],
      filas: [{ nombre: 'Ana Lugo' }],
      hayMas: false,
    })
    render(<App />)
    await screen.findByRole('heading', { name: 'Inicio' })
    irA('Datos')
    expect(
      await screen.findByRole('heading', { name: 'Datos' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Ana Lugo')).toBeInTheDocument()
    expect(datos.leerDatos).toHaveBeenCalledWith('cuentas', '')
  })

  it('manda al login si la sesión caduca en Datos', async () => {
    vi.mocked(api.obtenerSesion).mockResolvedValue(usuario)
    vi.mocked(datos.listarTablas).mockResolvedValue({
      ok: false,
      motivo: 'sesion',
    })
    render(<App />)
    await screen.findByRole('heading', { name: 'Inicio' })
    irA('Datos')
    expect(await screen.findByLabelText('Correo')).toBeInTheDocument()
  })

  it('a quien no es administrador no le muestra Datos ni la consulta', async () => {
    vi.mocked(api.obtenerSesion).mockResolvedValue({
      ...usuario,
      rol: 'usuario',
    })
    render(<App />)
    await screen.findByRole('heading', { name: 'Inicio' })
    expect(
      screen.queryByRole('button', { name: 'Datos' }),
    ).not.toBeInTheDocument()
    expect(datos.listarTablas).not.toHaveBeenCalled()
  })

  it('abre el estado del sistema aunque no sea administrador', async () => {
    vi.mocked(api.obtenerSesion).mockResolvedValue({
      ...usuario,
      rol: 'usuario',
    })
    vi.mocked(sistema.obtenerEstado).mockResolvedValue({
      ok: true,
      estado: {
        api: 'ok',
        baseDatosPanel: 'ok',
        baseDatosLecturas: 'ok',
        datos: 'sin_datos',
        variables: [],
      },
    })
    render(<App />)
    await screen.findByRole('heading', { name: 'Inicio' })
    irA('Estado')
    expect(
      await screen.findByRole('heading', { name: 'Estado del sistema' }),
    ).toBeInTheDocument()
  })

  it('manda al login si la sesión caduca en el estado', async () => {
    vi.mocked(api.obtenerSesion).mockResolvedValue(usuario)
    vi.mocked(sistema.obtenerEstado).mockResolvedValue({
      ok: false,
      motivo: 'sesion',
    })
    render(<App />)
    await screen.findByRole('heading', { name: 'Inicio' })
    irA('Estado')
    expect(await screen.findByLabelText('Correo')).toBeInTheDocument()
  })

  it('abre Mi cuenta con los datos de la sesión', async () => {
    vi.mocked(api.obtenerSesion).mockResolvedValue({
      ...usuario,
      rol: 'usuario',
    })
    render(<App />)
    await screen.findByRole('heading', { name: 'Inicio' })
    irA('Mi cuenta')
    expect(
      await screen.findByRole('heading', { name: 'Mi cuenta' }),
    ).toBeInTheDocument()
    expect(screen.getByText('eduardo@ejemplo.com')).toBeInTheDocument()
  })

  it('manda al login si la sesión caduca al cambiar la contraseña', async () => {
    vi.mocked(api.obtenerSesion).mockResolvedValue(usuario)
    vi.mocked(cuenta.cambiarContrasena).mockResolvedValue({
      ok: false,
      motivo: 'sesion',
    })
    render(<App />)
    await screen.findByRole('heading', { name: 'Inicio' })
    irA('Mi cuenta')
    fireEvent.change(await screen.findByLabelText('Contraseña actual'), {
      target: { value: 'la-clave-actual' },
    })
    fireEvent.change(screen.getByLabelText('Contraseña nueva'), {
      target: { value: 'una-clave-nueva-1' },
    })
    fireEvent.change(screen.getByLabelText('Repite la contraseña nueva'), {
      target: { value: 'una-clave-nueva-1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))
    expect(await screen.findByLabelText('Correo')).toBeInTheDocument()
  })

  it('la pantalla de cuentas recibe las acciones nuevas', async () => {
    vi.mocked(api.obtenerSesion).mockResolvedValue(usuario)
    vi.mocked(admin.listarCuentas).mockResolvedValue({
      ok: true,
      cuentas: [
        {
          id: 7,
          nombre: 'Ana Lopez',
          correo: 'ana@ejemplo.com',
          rol: 'usuario',
          estado: 'aprobado',
          bloqueada: true,
          creadoEn: '2026-10-30T15:00:00.000Z',
        },
      ],
    })
    vi.mocked(admin.desbloquearCuenta).mockResolvedValue({ ok: true })
    render(<App />)
    await screen.findByRole('heading', { name: 'Inicio' })
    irA('Cuentas')
    fireEvent.click(
      await screen.findByRole('button', { name: 'Desbloquear a Ana Lopez' }),
    )
    await waitFor(() => expect(admin.desbloquearCuenta).toHaveBeenCalledWith(7))
  })
})
