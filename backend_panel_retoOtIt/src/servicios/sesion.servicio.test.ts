import { describe, expect, it, vi } from 'vitest'
import { seguridad } from '../configuracion/seguridad'
import type { SesionActiva } from '../repositorios/sesiones.repositorio'
import { calcularHuellaToken, generarToken } from '../utilidades/tokens'
import { crearServicioSesion } from './sesion.servicio'

const sesionFalsa: SesionActiva = {
  sesionId: 7,
  usuarioId: 3,
  nombre: 'Ana',
  correo: 'ana@ejemplo.com',
  rol: 'usuario',
}

function crearDependenciasFalsas() {
  return {
    crearSesion: vi.fn().mockResolvedValue(undefined),
    buscarSesionActiva: vi.fn().mockResolvedValue(null),
    revocarSesion: vi.fn().mockResolvedValue(undefined),
    revocarSesionesDeUsuario: vi.fn().mockResolvedValue(undefined),
  }
}

describe('servicio de sesión', () => {
  it('iniciar guarda solo la huella del código y devuelve el código', async () => {
    const dependencias = crearDependenciasFalsas()
    const servicio = crearServicioSesion(dependencias)

    const token = await servicio.iniciar(3)

    expect(token).toMatch(/^[0-9a-f]{64}$/)
    expect(dependencias.crearSesion).toHaveBeenCalledWith(
      3,
      calcularHuellaToken(token),
      seguridad.sesion.duracionMaximaMs,
    )
    expect(dependencias.crearSesion.mock.calls[0]?.[1]).not.toBe(token)
  })

  it('validar devuelve la sesión que encuentra la base', async () => {
    const dependencias = crearDependenciasFalsas()
    dependencias.buscarSesionActiva.mockResolvedValue(sesionFalsa)
    const servicio = crearServicioSesion(dependencias)
    const token = generarToken()

    expect(await servicio.validar(token)).toEqual(sesionFalsa)
    expect(dependencias.buscarSesionActiva).toHaveBeenCalledWith(
      calcularHuellaToken(token),
      seguridad.sesion.inactividadMaximaMs,
    )
  })

  it('validar devuelve null si la base no encuentra una sesión que sirva', async () => {
    const servicio = crearServicioSesion(crearDependenciasFalsas())
    expect(await servicio.validar(generarToken())).toBeNull()
  })

  it.each([undefined, '', 'basura', 'A'.repeat(64)])(
    'validar devuelve null sin consultar la base si el código es %j',
    async (token) => {
      const dependencias = crearDependenciasFalsas()
      const servicio = crearServicioSesion(dependencias)

      expect(await servicio.validar(token)).toBeNull()
      expect(dependencias.buscarSesionActiva).not.toHaveBeenCalled()
    },
  )

  it('cerrar revoca la sesión usando la huella del código', async () => {
    const dependencias = crearDependenciasFalsas()
    const servicio = crearServicioSesion(dependencias)
    const token = generarToken()

    await servicio.cerrar(token)

    expect(dependencias.revocarSesion).toHaveBeenCalledWith(
      calcularHuellaToken(token),
    )
  })

  it('cerrar no hace nada con un código inválido', async () => {
    const dependencias = crearDependenciasFalsas()
    const servicio = crearServicioSesion(dependencias)

    await servicio.cerrar(undefined)
    await servicio.cerrar('basura')

    expect(dependencias.revocarSesion).not.toHaveBeenCalled()
  })

  it('cerrarTodasDe revoca todas las sesiones de la cuenta', async () => {
    const dependencias = crearDependenciasFalsas()
    const servicio = crearServicioSesion(dependencias)

    await servicio.cerrarTodasDe(3)

    expect(dependencias.revocarSesionesDeUsuario).toHaveBeenCalledWith(3)
  })
})
