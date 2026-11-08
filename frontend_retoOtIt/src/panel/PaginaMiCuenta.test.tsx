import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResultadoCambioClave } from './apiCuenta'
import PaginaMiCuenta from './PaginaMiCuenta'

const usuario = {
  id: 3,
  nombre: 'Ana Lopez',
  correo: 'ana@ejemplo.com',
  rol: 'usuario' as const,
}

function preparar(respuesta: ResultadoCambioClave = { ok: true }) {
  const props = {
    usuario,
    cambiar: vi
      .fn<(a: string, n: string) => Promise<ResultadoCambioClave>>()
      .mockResolvedValue(respuesta),
    sesionCaducada: vi.fn(),
  }
  render(<PaginaMiCuenta {...props} />)
  return props
}

function llenar(actual: string, nueva: string, repetida: string) {
  fireEvent.change(screen.getByLabelText('Contraseña actual'), {
    target: { value: actual },
  })
  fireEvent.change(screen.getByLabelText('Contraseña nueva'), {
    target: { value: nueva },
  })
  fireEvent.change(screen.getByLabelText('Repite la contraseña nueva'), {
    target: { value: repetida },
  })
}

const enviar = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))

beforeEach(() => vi.clearAllMocks())

describe('PaginaMiCuenta', () => {
  it('muestra los datos de la persona', () => {
    preparar()
    expect(screen.getByText('Ana Lopez')).toBeInTheDocument()
    expect(screen.getByText('ana@ejemplo.com')).toBeInTheDocument()
    expect(screen.getByText('usuario')).toBeInTheDocument()
  })

  it('cambia la contraseña, avisa y limpia los campos', async () => {
    const props = preparar()
    llenar('la-clave-actual', 'una-clave-nueva-1', 'una-clave-nueva-1')
    enviar()
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Tu contraseña se cambió. Cerramos tus otras sesiones.',
    )
    expect(props.cambiar).toHaveBeenCalledWith(
      'la-clave-actual',
      'una-clave-nueva-1',
    )
    expect(screen.getByLabelText('Contraseña actual')).toHaveValue('')
    expect(screen.getByLabelText('Contraseña nueva')).toHaveValue('')
  })

  it.each([
    ['', 'una-clave-nueva-1', 'una-clave-nueva-1', 'Completa los tres campos'],
    ['actual', 'corta', 'corta', 'de 12 a 128 caracteres'],
    ['actual', 'x'.repeat(129), 'x'.repeat(129), 'de 12 a 128 caracteres'],
    ['actual', 'una-clave-nueva-1', 'otra-distinta-123', 'no coincide'],
    [
      'una-clave-nueva-1',
      'una-clave-nueva-1',
      'una-clave-nueva-1',
      'distinta de la actual',
    ],
  ])('no envía si %j / %j / %j', async (actual, nueva, repetida, texto) => {
    const props = preparar()
    llenar(actual, nueva, repetida)
    enviar()
    expect(await screen.findByRole('alert')).toHaveTextContent(texto)
    expect(props.cambiar).not.toHaveBeenCalled()
  })

  it.each([
    ['actual_incorrecta', 'La contraseña actual no es correcta.'],
    ['bloqueada', 'Demasiados intentos fallidos'],
    ['limite', 'Demasiadas peticiones desde esta red'],
    ['invalido', 'Revisa las contraseñas'],
    ['fallo', 'No se pudo completar'],
  ] as const)(
    'muestra el aviso del motivo %s y conserva lo escrito',
    async (motivo, texto) => {
      preparar({ ok: false, motivo })
      llenar('la-clave-actual', 'una-clave-nueva-1', 'una-clave-nueva-1')
      enviar()
      expect(await screen.findByRole('alert')).toHaveTextContent(texto)
      expect(screen.getByLabelText('Contraseña nueva')).toHaveValue(
        'una-clave-nueva-1',
      )
    },
  )

  it('avisa a la app cuando la sesión caducó', async () => {
    const props = preparar({ ok: false, motivo: 'sesion' })
    llenar('la-clave-actual', 'una-clave-nueva-1', 'una-clave-nueva-1')
    enviar()
    await waitFor(() => expect(props.sesionCaducada).toHaveBeenCalledTimes(1))
  })

  it('muestra y oculta las contraseñas', () => {
    preparar()
    const campo = screen.getByLabelText('Contraseña nueva')
    expect(campo).toHaveAttribute('type', 'password')
    fireEvent.click(screen.getByLabelText('Mostrar contraseñas'))
    expect(campo).toHaveAttribute('type', 'text')
  })
})
