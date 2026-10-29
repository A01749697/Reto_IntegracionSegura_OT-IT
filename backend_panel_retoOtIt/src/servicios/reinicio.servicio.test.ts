import { afterEach, describe, expect, it, vi } from 'vitest'
import { seguridad } from '../configuracion/seguridad'
import type { Usuario } from '../repositorios/usuarios.repositorio'
import { calcularHuellaToken, generarToken } from '../utilidades/tokens'
import { crearServicioReinicio } from './reinicio.servicio'

const usuarioAprobado: Usuario = {
  id: 5,
  nombre: 'Ana',
  correo: 'ana@ejemplo.com',
  contrasenaHash: 'scrypt$...',
  rol: 'usuario',
  estado: 'aprobado',
  intentosFallidos: 0,
  bloqueadoHasta: null,
}

function crearDependenciasFalsas(usuario: Usuario | null) {
  return {
    buscarPorCorreo: vi.fn().mockResolvedValue(usuario),
    invalidarEnlacesPendientes: vi.fn().mockResolvedValue(undefined),
    crearEnlace: vi.fn().mockResolvedValue(undefined),
    enviarEnlaceReinicio: vi.fn().mockResolvedValue(undefined),
    consumirEnlace: vi.fn().mockResolvedValue(5),
    cambiarContrasena: vi.fn().mockResolvedValue(undefined),
    cerrarSesionesDe: vi.fn().mockResolvedValue(undefined),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

// Cada huella tarda una fracción de segundo a propósito; se da más margen de tiempo.
describe('servicio de reinicio', { timeout: 20000 }, () => {
  describe('pedir', () => {
    it('correo que no existe: no crea ni envía nada', async () => {
      const dependencias = crearDependenciasFalsas(null)
      const servicio = crearServicioReinicio(dependencias)

      await expect(servicio.pedir('nadie@ejemplo.com')).resolves.toBeUndefined()

      expect(dependencias.crearEnlace).not.toHaveBeenCalled()
      expect(dependencias.enviarEnlaceReinicio).not.toHaveBeenCalled()
    })

    it('cuenta rechazada: no crea ni envía nada', async () => {
      const dependencias = crearDependenciasFalsas({
        ...usuarioAprobado,
        estado: 'rechazado',
      })
      const servicio = crearServicioReinicio(dependencias)

      await servicio.pedir('ana@ejemplo.com')

      expect(dependencias.crearEnlace).not.toHaveBeenCalled()
      expect(dependencias.enviarEnlaceReinicio).not.toHaveBeenCalled()
    })

    it.each(['aprobado', 'pendiente'] as const)(
      'cuenta %s: guarda solo la huella del código y envía el código por correo',
      async (estado) => {
        const dependencias = crearDependenciasFalsas({
          ...usuarioAprobado,
          estado,
        })
        const servicio = crearServicioReinicio(dependencias)

        await servicio.pedir('ana@ejemplo.com')
        await vi.waitFor(() =>
          expect(dependencias.enviarEnlaceReinicio).toHaveBeenCalled(),
        )

        const [destinatario, token] =
          dependencias.enviarEnlaceReinicio.mock.calls[0] ?? []
        expect(destinatario).toBe('ana@ejemplo.com')
        expect(token).toMatch(/^[0-9a-f]{64}$/)
        expect(dependencias.invalidarEnlacesPendientes).toHaveBeenCalledWith(5)
        expect(dependencias.crearEnlace).toHaveBeenCalledWith(
          5,
          calcularHuellaToken(token),
          seguridad.reinicio.duracionEnlaceMs,
        )
      },
    )

    it('responde sin esperar a que el correo salga', async () => {
      const dependencias = crearDependenciasFalsas(usuarioAprobado)
      dependencias.enviarEnlaceReinicio.mockReturnValue(new Promise(() => {}))
      const servicio = crearServicioReinicio(dependencias)

      await expect(servicio.pedir('ana@ejemplo.com')).resolves.toBeUndefined()
    })

    it('si el envío falla, no falla la petición y el registro no incluye el código', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const dependencias = crearDependenciasFalsas(usuarioAprobado)
      dependencias.enviarEnlaceReinicio.mockRejectedValue(
        new Error('SES no responde'),
      )
      const servicio = crearServicioReinicio(dependencias)

      await expect(servicio.pedir('ana@ejemplo.com')).resolves.toBeUndefined()
      await vi.waitFor(() => expect(error).toHaveBeenCalled())

      const token = dependencias.enviarEnlaceReinicio.mock.calls[0]?.[1]
      expect(JSON.stringify(error.mock.calls)).toContain('SES no responde')
      expect(JSON.stringify(error.mock.calls)).not.toContain(token)
    })
  })

  describe('restablecer', () => {
    const token = generarToken()
    const contrasena = 'una-clave-nueva-1'

    it('con un enlace válido guarda la huella nueva y cierra las sesiones', async () => {
      const dependencias = crearDependenciasFalsas(null)
      const servicio = crearServicioReinicio(dependencias)

      expect(await servicio.restablecer({ token, contrasena })).toBe(true)

      expect(dependencias.consumirEnlace).toHaveBeenCalledWith(
        calcularHuellaToken(token),
      )
      const hash = dependencias.cambiarContrasena.mock.calls[0]?.[1]
      expect(dependencias.cambiarContrasena.mock.calls[0]?.[0]).toBe(5)
      expect(hash).toMatch(/^scrypt\$/)
      expect(hash).not.toContain(contrasena)
      expect(dependencias.cerrarSesionesDe).toHaveBeenCalledWith(5)
    })

    it('con un enlace que no sirve devuelve false y no cambia nada', async () => {
      const dependencias = crearDependenciasFalsas(null)
      dependencias.consumirEnlace.mockResolvedValue(null)
      const servicio = crearServicioReinicio(dependencias)

      expect(await servicio.restablecer({ token, contrasena })).toBe(false)

      expect(dependencias.cambiarContrasena).not.toHaveBeenCalled()
      expect(dependencias.cerrarSesionesDe).not.toHaveBeenCalled()
    })
  })
})
