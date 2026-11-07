import { describe, expect, it, vi } from 'vitest'
import type {
  Usuario,
  UsuarioResumen,
} from '../repositorios/usuarios.repositorio'
import { crearServicioAdministracion } from './administracion.servicio'

const ADMINISTRADOR_ID = 1
const IP = '203.0.113.7'
const AHORA = Date.parse('2026-11-07T18:00:00Z')

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
    cambiarRol: vi.fn().mockResolvedValue(true),
    limpiarIntentos: vi.fn().mockResolvedValue(undefined),
    cerrarSesionesDe: vi.fn().mockResolvedValue(undefined),
    registrarEvento: vi.fn().mockResolvedValue(undefined),
    ahora: () => AHORA,
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
        bloqueada: false,
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

    expect(await servicio.decidir(3, 'aprobado', ADMINISTRADOR_ID, IP)).toEqual(
      {
        ok: true,
      },
    )
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

    expect(
      await servicio.decidir(3, 'rechazado', ADMINISTRADOR_ID, IP),
    ).toEqual({
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

    expect(
      (await servicio.decidir(3, 'aprobado', ADMINISTRADOR_ID, IP)).ok,
    ).toBe(true)
  })

  it('nadie decide sobre su propia cuenta', async () => {
    const dependencias = crearDependenciasFalsas(crearUsuarioFalso())
    const servicio = crearServicioAdministracion(dependencias)

    expect(await servicio.decidir(1, 'rechazado', 1, IP)).toEqual({
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

    expect(
      await servicio.decidir(2, 'rechazado', ADMINISTRADOR_ID, IP),
    ).toEqual({
      ok: false,
      motivo: 'es_administrador',
    })
    expect(dependencias.cambiarEstado).not.toHaveBeenCalled()
    expect(dependencias.cerrarSesionesDe).not.toHaveBeenCalled()
  })

  it('avisa si la cuenta no existe', async () => {
    const dependencias = crearDependenciasFalsas(null)
    const servicio = crearServicioAdministracion(dependencias)

    expect(
      await servicio.decidir(99, 'aprobado', ADMINISTRADOR_ID, IP),
    ).toEqual({
      ok: false,
      motivo: 'no_existe',
    })
    expect(dependencias.cambiarEstado).not.toHaveBeenCalled()
  })

  it('avisa si la cuenta desaparece justo antes de guardar', async () => {
    const dependencias = crearDependenciasFalsas(crearUsuarioFalso())
    dependencias.cambiarEstado.mockResolvedValue(false)
    const servicio = crearServicioAdministracion(dependencias)

    expect(
      await servicio.decidir(3, 'rechazado', ADMINISTRADOR_ID, IP),
    ).toEqual({
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

    expect(await servicio.decidir(3, 'aprobado', ADMINISTRADOR_ID, IP)).toEqual(
      {
        ok: false,
        motivo: 'sin_cambio',
      },
    )
    expect(dependencias.cambiarEstado).not.toHaveBeenCalled()
  })

  it.each([
    ['aprobado', 'cuenta_aprobada'],
    ['rechazado', 'cuenta_rechazada'],
  ] as const)(
    'al decidir %s anota %s con quién la decidió',
    async (decision, tipo) => {
      const estado = decision === 'aprobado' ? 'pendiente' : 'aprobado'
      const dependencias = crearDependenciasFalsas(
        crearUsuarioFalso({ estado }),
      )
      const servicio = crearServicioAdministracion(dependencias)

      await servicio.decidir(3, decision, ADMINISTRADOR_ID, IP)

      expect(dependencias.registrarEvento).toHaveBeenCalledWith({
        tipo,
        usuarioId: 3,
        actorId: ADMINISTRADOR_ID,
        correo: 'ana@ejemplo.com',
        ip: IP,
      })
    },
  )

  it('no anota nada si la decisión no se pudo aplicar', async () => {
    const dependencias = crearDependenciasFalsas(null)
    const servicio = crearServicioAdministracion(dependencias)

    await servicio.decidir(3, 'aprobado', ADMINISTRADOR_ID, IP)

    expect(dependencias.registrarEvento).not.toHaveBeenCalled()
  })

  it('listar acepta pedir todas las cuentas', async () => {
    const dependencias = crearDependenciasFalsas(null)
    const servicio = crearServicioAdministracion(dependencias)
    await servicio.listar('todas')
    expect(dependencias.listarPorEstado).toHaveBeenCalledWith('todas')
  })

  describe('desbloquear', () => {
    it('quita el bloqueo y anota quién lo hizo', async () => {
      const dependencias = crearDependenciasFalsas(
        crearUsuarioFalso({
          estado: 'aprobado',
          bloqueadoHasta: new Date(AHORA + 60_000),
        }),
      )
      const servicio = crearServicioAdministracion(dependencias)

      expect(await servicio.desbloquear(3, ADMINISTRADOR_ID, IP)).toEqual({
        ok: true,
      })
      expect(dependencias.limpiarIntentos).toHaveBeenCalledWith(3)
      expect(dependencias.registrarEvento).toHaveBeenCalledWith({
        tipo: 'cuenta_desbloqueada',
        usuarioId: 3,
        actorId: ADMINISTRADOR_ID,
        correo: 'ana@ejemplo.com',
        ip: IP,
      })
    })

    it.each([
      ['sin bloqueo', null],
      ['con un bloqueo que ya venció', new Date(AHORA - 1000)],
    ])('responde sin_cambio si la cuenta está %s', async (_texto, hasta) => {
      const dependencias = crearDependenciasFalsas(
        crearUsuarioFalso({ bloqueadoHasta: hasta }),
      )
      const servicio = crearServicioAdministracion(dependencias)

      expect(await servicio.desbloquear(3, ADMINISTRADOR_ID, IP)).toEqual({
        ok: false,
        motivo: 'sin_cambio',
      })
      expect(dependencias.limpiarIntentos).not.toHaveBeenCalled()
      expect(dependencias.registrarEvento).not.toHaveBeenCalled()
    })

    it('responde no_existe si la cuenta no está', async () => {
      const servicio = crearServicioAdministracion(
        crearDependenciasFalsas(null),
      )
      expect(await servicio.desbloquear(3, ADMINISTRADOR_ID, IP)).toEqual({
        ok: false,
        motivo: 'no_existe',
      })
    })
  })

  describe('hacerAdministrador', () => {
    it('promueve una cuenta aprobada y anota quién lo hizo', async () => {
      const dependencias = crearDependenciasFalsas(
        crearUsuarioFalso({ estado: 'aprobado' }),
      )
      const servicio = crearServicioAdministracion(dependencias)

      expect(
        await servicio.hacerAdministrador(3, ADMINISTRADOR_ID, IP),
      ).toEqual({ ok: true })
      expect(dependencias.cambiarRol).toHaveBeenCalledWith(3, 'administrador')
      expect(dependencias.registrarEvento).toHaveBeenCalledWith({
        tipo: 'rol_cambiado',
        usuarioId: 3,
        actorId: ADMINISTRADOR_ID,
        correo: 'ana@ejemplo.com',
        ip: IP,
      })
    })

    it.each(['pendiente', 'rechazado'] as const)(
      'no promueve una cuenta %s',
      async (estado) => {
        const dependencias = crearDependenciasFalsas(
          crearUsuarioFalso({ estado }),
        )
        const servicio = crearServicioAdministracion(dependencias)

        expect(
          await servicio.hacerAdministrador(3, ADMINISTRADOR_ID, IP),
        ).toEqual({ ok: false, motivo: 'no_aprobada' })
        expect(dependencias.cambiarRol).not.toHaveBeenCalled()
      },
    )

    it('responde sin_cambio si ya es administradora', async () => {
      const dependencias = crearDependenciasFalsas(
        crearUsuarioFalso({ estado: 'aprobado', rol: 'administrador' }),
      )
      const servicio = crearServicioAdministracion(dependencias)

      expect(
        await servicio.hacerAdministrador(3, ADMINISTRADOR_ID, IP),
      ).toEqual({ ok: false, motivo: 'sin_cambio' })
      expect(dependencias.cambiarRol).not.toHaveBeenCalled()
    })

    it('responde no_existe si la cuenta no está o desaparece al cambiarla', async () => {
      const sin = crearServicioAdministracion(crearDependenciasFalsas(null))
      expect(await sin.hacerAdministrador(3, ADMINISTRADOR_ID, IP)).toEqual({
        ok: false,
        motivo: 'no_existe',
      })

      const dependencias = crearDependenciasFalsas(
        crearUsuarioFalso({ estado: 'aprobado' }),
      )
      dependencias.cambiarRol.mockResolvedValue(false)
      const servicio = crearServicioAdministracion(dependencias)
      expect(
        await servicio.hacerAdministrador(3, ADMINISTRADOR_ID, IP),
      ).toEqual({ ok: false, motivo: 'no_existe' })
      expect(dependencias.registrarEvento).not.toHaveBeenCalled()
    })
  })
})
