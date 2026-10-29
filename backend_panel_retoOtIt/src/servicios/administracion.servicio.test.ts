import { describe, expect, it, vi } from 'vitest'
import type {
  Usuario,
  UsuarioResumen,
} from '../repositorios/usuarios.repositorio'
import { crearServicioAdministracion } from './administracion.servicio'

const ADMINISTRADOR_ID = 1

function crearUsuarioFalso(cambios: Partial<Usuario> = {}): Usuario {
  return {
    id: 3,
    nombre: 'Ana',
    correo: 'ana@ejemplo.com',
    contrasenaHash: 'scrypt$...',
    rol: 'usuario',
    estado: 'pendiente',
    intentosFallidos: 0,
    bloqueadoHasta: null,
    ...cambios,
  }
}

function crearDependenciasFalsas(usuario: Usuario | null) {
  return {
    listarPorEstado: vi.fn().mockResolvedValue([]),
    buscarPorId: vi.fn().mockResolvedValue(usuario),
    cambiarEstado: vi.fn().mockResolvedValue(true),
    cerrarSesionesDe: vi.fn().mockResolvedValue(undefined),
  }
}

describe('servicio de administración', () => {
  it('listar devuelve lo que entrega la base para ese estado', async () => {
    const dependencias = crearDependenciasFalsas(null)
    const pendientes: UsuarioResumen[] = [
      {
        id: 3,
        nombre: 'Ana',
        correo: 'ana@ejemplo.com',
        rol: 'usuario',
        estado: 'pendiente',
        creadoEn: new Date('2026-10-28T16:00:00Z'),
      },
    ]
    dependencias.listarPorEstado.mockResolvedValue(pendientes)
    const servicio = crearServicioAdministracion(dependencias)

    expect(await servicio.listar('pendiente')).toEqual(pendientes)
    expect(dependencias.listarPorEstado).toHaveBeenCalledWith('pendiente')
  })

  it('aprueba una cuenta pendiente y guarda quién decidió', async () => {
    const dependencias = crearDependenciasFalsas(crearUsuarioFalso())
    const servicio = crearServicioAdministracion(dependencias)

    expect(await servicio.decidir(3, 'aprobado', ADMINISTRADOR_ID)).toEqual({
      ok: true,
    })
    expect(dependencias.cambiarEstado).toHaveBeenCalledWith(
      3,
      'aprobado',
      ADMINISTRADOR_ID,
    )
    expect(dependencias.cerrarSesionesDe).not.toHaveBeenCalled()
  })

  it('rechaza una cuenta aprobada y cierra sus sesiones', async () => {
    const dependencias = crearDependenciasFalsas(
      crearUsuarioFalso({ estado: 'aprobado' }),
    )
    const servicio = crearServicioAdministracion(dependencias)

    expect(await servicio.decidir(3, 'rechazado', ADMINISTRADOR_ID)).toEqual({
      ok: true,
    })
    expect(dependencias.cambiarEstado).toHaveBeenCalledWith(
      3,
      'rechazado',
      ADMINISTRADOR_ID,
    )
    expect(dependencias.cerrarSesionesDe).toHaveBeenCalledWith(3)
  })

  it('permite aprobar una cuenta que había sido rechazada', async () => {
    const dependencias = crearDependenciasFalsas(
      crearUsuarioFalso({ estado: 'rechazado' }),
    )
    const servicio = crearServicioAdministracion(dependencias)

    expect((await servicio.decidir(3, 'aprobado', ADMINISTRADOR_ID)).ok).toBe(
      true,
    )
  })

  it('nadie decide sobre su propia cuenta', async () => {
    const dependencias = crearDependenciasFalsas(crearUsuarioFalso())
    const servicio = crearServicioAdministracion(dependencias)

    expect(await servicio.decidir(1, 'rechazado', 1)).toEqual({
      ok: false,
      motivo: 'es_propia',
    })
    expect(dependencias.cambiarEstado).not.toHaveBeenCalled()
  })

  it('no toca cuentas de administrador', async () => {
    const dependencias = crearDependenciasFalsas(
      crearUsuarioFalso({ id: 2, rol: 'administrador', estado: 'aprobado' }),
    )
    const servicio = crearServicioAdministracion(dependencias)

    expect(await servicio.decidir(2, 'rechazado', ADMINISTRADOR_ID)).toEqual({
      ok: false,
      motivo: 'es_administrador',
    })
    expect(dependencias.cambiarEstado).not.toHaveBeenCalled()
    expect(dependencias.cerrarSesionesDe).not.toHaveBeenCalled()
  })

  it('avisa si la cuenta no existe', async () => {
    const dependencias = crearDependenciasFalsas(null)
    const servicio = crearServicioAdministracion(dependencias)

    expect(await servicio.decidir(99, 'aprobado', ADMINISTRADOR_ID)).toEqual({
      ok: false,
      motivo: 'no_existe',
    })
    expect(dependencias.cambiarEstado).not.toHaveBeenCalled()
  })

  it('avisa si la cuenta desaparece justo antes de guardar', async () => {
    const dependencias = crearDependenciasFalsas(crearUsuarioFalso())
    dependencias.cambiarEstado.mockResolvedValue(false)
    const servicio = crearServicioAdministracion(dependencias)

    expect(await servicio.decidir(3, 'rechazado', ADMINISTRADOR_ID)).toEqual({
      ok: false,
      motivo: 'no_existe',
    })
    expect(dependencias.cerrarSesionesDe).not.toHaveBeenCalled()
  })

  it('no repite una decisión que ya está tomada', async () => {
    const dependencias = crearDependenciasFalsas(
      crearUsuarioFalso({ estado: 'aprobado' }),
    )
    const servicio = crearServicioAdministracion(dependencias)

    expect(await servicio.decidir(3, 'aprobado', ADMINISTRADOR_ID)).toEqual({
      ok: false,
      motivo: 'sin_cambio',
    })
    expect(dependencias.cambiarEstado).not.toHaveBeenCalled()
  })
})
