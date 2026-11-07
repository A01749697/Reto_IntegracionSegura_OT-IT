import { beforeAll, describe, expect, it, vi } from 'vitest'
import { seguridad } from '../configuracion/seguridad'
import type { Usuario } from '../repositorios/usuarios.repositorio'
import { crearHuella, verificarContrasena } from '../utilidades/contrasenas'
import { crearServicioCuenta } from './cuenta.servicio'

const AHORA = Date.parse('2026-11-07T18:00:00Z')
const IP = '203.0.113.7'
const ACTUAL = 'la-clave-actual-1'
const NUEVA = 'otra-clave-distinta-2'
let huella = ''

beforeAll(async () => {
  huella = await crearHuella(ACTUAL)
})

function crearUsuarioFalso(cambios: Partial<Usuario> = {}): Usuario {
  return {
    id: 3,
    nombre: 'Ana',
    correo: 'ana@ejemplo.com',
    contrasenaHash: huella,
    rol: 'usuario',
    estado: 'aprobado',
    intentosFallidos: 0,
    bloqueadoHasta: null,
    ...cambios,
  }
}

function preparar(usuario: Usuario | null) {
  const dependencias = {
    buscarPorId: vi.fn().mockResolvedValue(usuario),
    registrarIntentoFallido: vi.fn().mockResolvedValue(undefined),
    cambiarContrasena: vi.fn().mockResolvedValue(undefined),
    cerrarOtrasSesiones: vi.fn().mockResolvedValue(undefined),
    registrarEvento: vi.fn().mockResolvedValue(undefined),
    ahora: () => AHORA,
  }
  return { dependencias, servicio: crearServicioCuenta(dependencias) }
}

describe('servicio de cuenta', { timeout: 20000 }, () => {
  it('con la contraseña actual correcta cambia la huella y cierra las otras sesiones', async () => {
    const { dependencias, servicio } = preparar(crearUsuarioFalso())

    const resultado = await servicio.cambiarContrasena(
      3,
      10,
      { actual: ACTUAL, nueva: NUEVA },
      IP,
    )

    expect(resultado).toEqual({ ok: true })
    const [id, nuevaHuella] = dependencias.cambiarContrasena.mock.calls[0] ?? []
    expect(id).toBe(3)
    expect(nuevaHuella).not.toBe(NUEVA)
    expect(await verificarContrasena(NUEVA, nuevaHuella)).toBe(true)
    expect(dependencias.cerrarOtrasSesiones).toHaveBeenCalledWith(3, 10)
    expect(dependencias.registrarEvento).toHaveBeenCalledWith({
      tipo: 'contrasena_cambiada',
      usuarioId: 3,
      correo: 'ana@ejemplo.com',
      ip: IP,
    })
  })

  it('con la actual incorrecta no cambia nada, cuenta el intento y lo anota', async () => {
    const { dependencias, servicio } = preparar(crearUsuarioFalso())

    const resultado = await servicio.cambiarContrasena(
      3,
      10,
      { actual: 'incorrecta-incorrecta', nueva: NUEVA },
      IP,
    )

    expect(resultado).toEqual({ ok: false, motivo: 'actual_incorrecta' })
    expect(dependencias.registrarIntentoFallido).toHaveBeenCalledWith(
      3,
      seguridad.bloqueo.intentosMaximos,
      seguridad.bloqueo.duracionMs,
    )
    expect(dependencias.cambiarContrasena).not.toHaveBeenCalled()
    expect(dependencias.cerrarOtrasSesiones).not.toHaveBeenCalled()
    expect(dependencias.registrarEvento).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'cambio_contrasena_fallido' }),
    )
  })

  it('el último intento permitido también anota que la cuenta se bloqueó', async () => {
    const { dependencias, servicio } = preparar(
      crearUsuarioFalso({
        intentosFallidos: seguridad.bloqueo.intentosMaximos - 1,
      }),
    )

    await servicio.cambiarContrasena(
      3,
      10,
      { actual: 'incorrecta-incorrecta', nueva: NUEVA },
      IP,
    )

    const tipos = dependencias.registrarEvento.mock.calls.map(
      (llamada) => llamada[0].tipo,
    )
    expect(tipos).toEqual(['cambio_contrasena_fallido', 'cuenta_bloqueada'])
  })

  it('con la cuenta bloqueada ni siquiera prueba la contraseña', async () => {
    const { dependencias, servicio } = preparar(
      crearUsuarioFalso({ bloqueadoHasta: new Date(AHORA + 60_000) }),
    )

    const resultado = await servicio.cambiarContrasena(
      3,
      10,
      { actual: ACTUAL, nueva: NUEVA },
      IP,
    )

    expect(resultado).toEqual({ ok: false, motivo: 'bloqueada' })
    expect(dependencias.cambiarContrasena).not.toHaveBeenCalled()
    expect(dependencias.registrarIntentoFallido).not.toHaveBeenCalled()
    expect(dependencias.registrarEvento).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'cambio_contrasena_fallido' }),
    )
  })

  it('un bloqueo que ya venció no estorba', async () => {
    const { servicio } = preparar(
      crearUsuarioFalso({ bloqueadoHasta: new Date(AHORA - 1000) }),
    )
    const resultado = await servicio.cambiarContrasena(
      3,
      10,
      { actual: ACTUAL, nueva: NUEVA },
      IP,
    )
    expect(resultado).toEqual({ ok: true })
  })

  it('si la cuenta ya no existe responde no_existe', async () => {
    const { servicio } = preparar(null)
    expect(
      await servicio.cambiarContrasena(
        3,
        10,
        { actual: ACTUAL, nueva: NUEVA },
        IP,
      ),
    ).toEqual({ ok: false, motivo: 'no_existe' })
  })
})
