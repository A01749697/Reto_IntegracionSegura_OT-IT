import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { MotivoEntrar, Usuario } from './apiPanel'
import PaginaLogin, { type PaginaLoginProps } from './PaginaLogin'

const usuarioPrueba: Usuario = {
  id: 2,
  nombre: 'Eduardo Serrano',
  correo: 'eduardo@ejemplo.com',
  rol: 'administrador',
}

function preparar(cambios: Partial<PaginaLoginProps> = {}) {
  const props: PaginaLoginProps = {
    autenticar: vi
      .fn()
      .mockResolvedValue({ ok: false, motivo: 'credenciales' }),
    solicitarCuenta: vi.fn().mockResolvedValue({ ok: true }),
    recuperarClave: vi.fn().mockResolvedValue({ ok: true }),
    restablecerClave: vi.fn().mockResolvedValue({ ok: true }),
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
    expect(screen.getByLabelText('Correo')).toBeInTheDocument()
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

  it('avisa si faltan el correo o la contrasena', () => {
    const props = preparar()
    entrar()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Escribe tu correo y tu contraseña.',
    )
    expect(props.autenticar).not.toHaveBeenCalled()
  })

  it('envia los datos sin espacios sobrantes en el correo', async () => {
    const props = preparar()
    escribir('Correo', '  eduardo@ejemplo.com ')
    escribir('Contraseña', 'clave-incorrecta')
    entrar()
    await waitFor(() => expect(props.autenticar).toHaveBeenCalledTimes(1))
    expect(props.autenticar).toHaveBeenCalledWith(
      'eduardo@ejemplo.com',
      'clave-incorrecta',
    )
  })

  it.each<[MotivoEntrar, string]>([
    ['credenciales', 'Correo o contraseña incorrectos.'],
    ['pendiente', 'pendiente de aprobación'],
    ['rechazada', 'no fue aprobada'],
    ['bloqueada', 'Demasiados intentos fallidos'],
    ['limite', 'desde esta red'],
    ['invalido', 'Revisa que el correo'],
    ['fallo', 'No se pudo conectar'],
  ])('muestra el aviso cuando el motivo es %s', async (motivo, texto) => {
    preparar({
      autenticar: vi.fn().mockResolvedValue({ ok: false, motivo }),
    })
    escribir('Correo', 'eduardo@ejemplo.com')
    escribir('Contraseña', 'una-clave-cualquiera')
    entrar()
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(texto),
    )
  })

  it('avisa que no hubo conexion si la peticion falla', async () => {
    preparar({ autenticar: vi.fn().mockRejectedValue(new Error('red')) })
    escribir('Correo', 'eduardo@ejemplo.com')
    escribir('Contraseña', 'una-clave-cualquiera')
    entrar()
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'No se pudo conectar',
      ),
    )
  })

  it('llama a alIniciarSesion con el usuario cuando los datos son correctos', async () => {
    const alIniciarSesion = vi.fn()
    preparar({
      autenticar: vi
        .fn()
        .mockResolvedValue({ ok: true, usuario: usuarioPrueba }),
      alIniciarSesion,
    })
    escribir('Correo', 'eduardo@ejemplo.com')
    escribir('Contraseña', 'clave-correcta')
    entrar()
    await waitFor(() =>
      expect(alIniciarSesion).toHaveBeenCalledWith(usuarioPrueba),
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('no bloquea el boton en el navegador despues de varios fallos', async () => {
    const props = preparar()
    escribir('Correo', 'eduardo@ejemplo.com')
    escribir('Contraseña', 'mal')
    for (let i = 1; i <= 4; i++) {
      entrar()
      await waitFor(() => expect(props.autenticar).toHaveBeenCalledTimes(i))
      await screen.findByRole('alert')
    }
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeEnabled()
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

  describe('recuperar contrasena', () => {
    function abrir() {
      const props = preparar()
      fireEvent.click(
        screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }),
      )
      return props
    }
    const enviar = () =>
      fireEvent.click(
        screen.getByRole('button', { name: 'Enviar instrucciones' }),
      )

    it('pide el correo y muestra el mismo mensaje exista o no la cuenta', async () => {
      const props = abrir()
      expect(
        screen.getByRole('heading', { name: 'Recuperar contraseña' }),
      ).toBeInTheDocument()

      enviar()
      expect(screen.getByRole('alert')).toHaveTextContent('Escribe tu correo.')

      escribir('Correo', 'alguien@ejemplo.com')
      enviar()
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

    it('avisa cuando el correo no es valido', async () => {
      const props = preparar({
        recuperarClave: vi
          .fn()
          .mockResolvedValue({ ok: false, motivo: 'invalido' }),
      })
      fireEvent.click(
        screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }),
      )
      escribir('Correo', 'esto-no-es-un-correo')
      enviar()
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Escribe un correo válido.',
        ),
      )
      expect(props.recuperarClave).toHaveBeenCalledTimes(1)
    })

    it('avisa cuando hay demasiadas peticiones', async () => {
      preparar({
        recuperarClave: vi
          .fn()
          .mockResolvedValue({ ok: false, motivo: 'limite' }),
      })
      fireEvent.click(
        screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }),
      )
      escribir('Correo', 'alguien@ejemplo.com')
      enviar()
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent('Demasiadas'),
      )
    })
  })

  describe('crear cuenta', () => {
    function abrir(cambios: Partial<PaginaLoginProps> = {}) {
      const props = preparar(cambios)
      fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
      return props
    }
    const enviar = () =>
      fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }))

    function llenar() {
      escribir('Nombre completo', 'Eduardo Serrano')
      escribir('Correo', 'eduardo@ejemplo.com')
      escribir('Contraseña', 'una-clave-larga-1')
      escribir('Repite la contraseña', 'una-clave-larga-1')
    }

    it('valida la solicitud y la envia', async () => {
      const props = abrir()
      expect(
        screen.getByRole('heading', { name: 'Crear cuenta' }),
      ).toBeInTheDocument()

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

    it('limpia los campos cuando la solicitud se envia', async () => {
      abrir()
      llenar()
      enviar()
      await screen.findByRole('status')
      expect(screen.getByLabelText('Nombre completo')).toHaveValue('')
      expect(screen.getByLabelText('Contraseña')).toHaveValue('')
    })

    it('muestra lo que dijo el servidor cuando los datos no sirven', async () => {
      abrir({
        solicitarCuenta: vi.fn().mockResolvedValue({
          ok: false,
          motivo: 'invalido',
          mensaje: 'correo no es válido',
        }),
      })
      llenar()
      enviar()
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(
          'No se pudo crear la cuenta: correo no es válido.',
        ),
      )
    })

    it('muestra un aviso general cuando el servidor no da detalle', async () => {
      abrir({
        solicitarCuenta: vi
          .fn()
          .mockResolvedValue({ ok: false, motivo: 'invalido' }),
      })
      llenar()
      enviar()
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Revisa los datos que escribiste.',
        ),
      )
    })

    it('avisa cuando no hay conexion', async () => {
      abrir({ solicitarCuenta: vi.fn().mockRejectedValue(new Error('red')) })
      llenar()
      enviar()
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent('No se pudo'),
      )
    })
  })

  describe('contrasena nueva', () => {
    const token = 'a'.repeat(64)
    const cambiar = () =>
      fireEvent.click(
        screen.getByRole('button', { name: 'Cambiar contraseña' }),
      )

    function abrir(cambios: Partial<PaginaLoginProps> = {}) {
      return preparar({ tokenInicial: token, ...cambios })
    }

    it('abre directo la pantalla cuando llega con un codigo', () => {
      abrir()
      expect(
        screen.getByRole('heading', { name: 'Contraseña nueva' }),
      ).toBeInTheDocument()
    })

    it('no la muestra si no hay codigo', () => {
      preparar()
      expect(
        screen.queryByRole('heading', { name: 'Contraseña nueva' }),
      ).not.toBeInTheDocument()
    })

    it('valida los campos antes de enviar', () => {
      const props = abrir()
      cambiar()
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Completa los dos campos.',
      )

      escribir('Contraseña nueva', 'corta')
      escribir('Repite la contraseña nueva', 'corta')
      cambiar()
      expect(screen.getByRole('alert')).toHaveTextContent('al menos 12')

      escribir('Contraseña nueva', 'una-clave-larga-1')
      escribir('Repite la contraseña nueva', 'otra-clave-larga-2')
      cambiar()
      expect(screen.getByRole('alert')).toHaveTextContent('no coinciden')
      expect(props.restablecerClave).not.toHaveBeenCalled()
    })

    it('envia el codigo con la contrasena y deja volver al login', async () => {
      const props = abrir()
      escribir('Contraseña nueva', 'una-clave-larga-1')
      escribir('Repite la contraseña nueva', 'una-clave-larga-1')
      cambiar()
      await waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent(
          'Tu contraseña se cambió.',
        ),
      )
      expect(props.restablecerClave).toHaveBeenCalledWith(
        token,
        'una-clave-larga-1',
      )

      fireEvent.click(
        screen.getByRole('button', { name: 'Ir a iniciar sesión' }),
      )
      expect(screen.getByLabelText('Correo')).toBeInTheDocument()
    })

    it('avisa cuando el enlace ya no sirve', async () => {
      abrir({
        restablecerClave: vi
          .fn()
          .mockResolvedValue({ ok: false, motivo: 'invalido' }),
      })
      escribir('Contraseña nueva', 'una-clave-larga-1')
      escribir('Repite la contraseña nueva', 'una-clave-larga-1')
      cambiar()
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(
          'El enlace no es válido o ya caducó',
        ),
      )
    })

    it('avisa cuando no hay conexion', async () => {
      abrir({ restablecerClave: vi.fn().mockRejectedValue(new Error('red')) })
      escribir('Contraseña nueva', 'una-clave-larga-1')
      escribir('Repite la contraseña nueva', 'una-clave-larga-1')
      cambiar()
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent('No se pudo'),
      )
    })
  })
})
