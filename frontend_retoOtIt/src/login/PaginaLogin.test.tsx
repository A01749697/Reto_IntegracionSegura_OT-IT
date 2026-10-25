import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PaginaLogin, { type PaginaLoginProps } from './PaginaLogin'

function preparar(cambios: Partial<PaginaLoginProps> = {}) {
  const props: PaginaLoginProps = {
    autenticar: vi.fn().mockResolvedValue(false),
    solicitarCuenta: vi.fn().mockResolvedValue(undefined),
    recuperarClave: vi.fn().mockResolvedValue(undefined),
    ...cambios,
  }
  render(<PaginaLogin {...props} />)
  return props
}

function escribir(etiqueta: string, valor: string) {
  fireEvent.change(screen.getByLabelText(etiqueta), {
    target: { value: valor },
  })
}

const entrar = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

describe('PaginaLogin', () => {
  it('muestra el formulario de inicio de sesion', () => {
    preparar()
    expect(
      screen.getByRole('heading', { name: 'Panel Reto OT-IT' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Usuario')).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Iniciar sesión' }),
    ).toBeInTheDocument()
  })

  it('muestra las cuatro zonas del flujo', () => {
    preparar()
    for (const zona of ['OT', 'IDMZ', 'IT', 'NUBE']) {
      expect(screen.getByText(zona)).toBeInTheDocument()
    }
  })

  it('avisa si faltan el usuario o la contrasena', () => {
    const props = preparar()
    entrar()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Escribe tu usuario y tu contraseña.',
    )
    expect(props.autenticar).not.toHaveBeenCalled()
  })

  it('envia los datos y avisa cuando son incorrectos', async () => {
    const props = preparar()
    escribir('Usuario', 'eduardo')
    escribir('Contraseña', 'clave-incorrecta')
    entrar()
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Usuario o contraseña incorrectos.',
      ),
    )
    expect(props.autenticar).toHaveBeenCalledWith('eduardo', 'clave-incorrecta')
  })

  it('llama a alIniciarSesion cuando los datos son correctos', async () => {
    const alIniciarSesion = vi.fn()
    preparar({
      autenticar: vi.fn().mockResolvedValue(true),
      alIniciarSesion,
    })
    escribir('Usuario', 'eduardo')
    escribir('Contraseña', 'clave-correcta')
    entrar()
    await waitFor(() => expect(alIniciarSesion).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('bloquea el acceso tras tres intentos fallidos', async () => {
    const props = preparar()
    escribir('Usuario', 'eduardo')
    escribir('Contraseña', 'mal')
    for (let i = 1; i <= 3; i++) {
      entrar()
      await waitFor(() => expect(props.autenticar).toHaveBeenCalledTimes(i))
      await screen.findByRole('alert')
    }
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Acceso bloqueado/ }),
      ).toBeDisabled(),
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Demasiados intentos, espera unos minutos.',
    )
  })

  it('muestra y oculta la contrasena', () => {
    preparar()
    const campo = screen.getByLabelText('Contraseña')
    expect(campo).toHaveAttribute('type', 'password')
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    expect(campo).toHaveAttribute('type', 'text')
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }))
    expect(campo).toHaveAttribute('type', 'password')
  })

  it('avisa cuando Bloq Mayus esta activado', () => {
    preparar()
    const campo = screen.getByLabelText('Contraseña')
    fireEvent.keyUp(campo, { key: 'A', modifierCapsLock: true })
    expect(screen.getByRole('status')).toHaveTextContent(
      'Bloq Mayús está activado',
    )
    fireEvent.blur(campo)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('recupera la contrasena con el mismo mensaje exista o no la cuenta', async () => {
    const props = preparar()
    fireEvent.click(
      screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }),
    )
    expect(
      screen.getByRole('heading', { name: 'Recuperar contraseña' }),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Enviar instrucciones' }),
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Escribe tu usuario o tu correo.',
    )

    escribir('Usuario o correo', 'alguien@ejemplo.com')
    fireEvent.click(
      screen.getByRole('button', { name: 'Enviar instrucciones' }),
    )
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Listo.'),
    )
    expect(props.recuperarClave).toHaveBeenCalledWith('alguien@ejemplo.com')

    fireEvent.click(
      screen.getByRole('button', { name: 'Volver a iniciar sesión' }),
    )
    expect(
      screen.getByRole('heading', { name: 'Panel Reto OT-IT' }),
    ).toBeInTheDocument()
  })

  it('valida la solicitud de cuenta y la envia', async () => {
    const props = preparar()
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    expect(
      screen.getByRole('heading', { name: 'Crear cuenta' }),
    ).toBeInTheDocument()

    const enviar = () =>
      fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }))

    enviar()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Completa todos los campos.',
    )

    escribir('Nombre completo', 'Eduardo Serrano')
    escribir('Correo', 'eduardo@ejemplo.com')
    escribir('Contraseña', 'corta')
    escribir('Repite la contraseña', 'corta')
    enviar()
    expect(screen.getByRole('alert')).toHaveTextContent('al menos 12')

    escribir('Contraseña', 'una-clave-larga-1')
    escribir('Repite la contraseña', 'otra-clave-larga-2')
    enviar()
    expect(screen.getByRole('alert')).toHaveTextContent('no coinciden')

    escribir('Repite la contraseña', 'una-clave-larga-1')
    enviar()
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Solicitud enviada.',
      ),
    )
    expect(props.solicitarCuenta).toHaveBeenCalledWith({
      nombre: 'Eduardo Serrano',
      correo: 'eduardo@ejemplo.com',
      clave: 'una-clave-larga-1',
    })
  })
})
