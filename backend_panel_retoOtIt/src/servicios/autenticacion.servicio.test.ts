import { beforeAll, describe, expect, it, vi } from 'vitest'
import { seguridad } from '../configuracion/seguridad'
import type { Usuario } from '../repositorios/usuarios.repositorio'
import { crearHuella } from '../utilidades/contrasenas'
import { crearServicioAutenticacion } from './autenticacion.servicio'

const AHORA = Date.parse('2026-10-28T20:00:00Z')
const CONTRASENA = 'una-clave-larga-1'
let huella = ''

function crearUsuarioFalso(cambios: Partial<Usuario> = {}): Usuario {
  return {
    id: 5,
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

function crearDependenciasFalsas(usuario: Usuario | null) {
  return {
    crearUsuario: vi.fn().mockResolvedValue({ creado: true, id: 5 }),
    buscarPorCorreo: vi.fn().mockResolvedValue(usuario),
    registrarIntentoFallido: vi.fn().mockResolvedValue(undefined),
    limpiarIntentos: vi.fn().mockResolvedValue(undefined),
    iniciarSesion: vi.fn().mockResolvedValue('token-de-prueba'),
    ahora: () => AHORA,
  }
}

const datosEntrar = { correo: 'ana@ejemplo.com', contrasena: CONTRASENA }
const datosIncorrectos = {
  correo: 'ana@ejemplo.com',
  contrasena: 'otra-clave-1234',
}

// Cada huella tarda una fracción de segundo a propósito; se da más margen de tiempo.
describe('servicio de autenticación', { timeout: 20000 }, () => {
  beforeAll(async () => {
    huella = await crearHuella(CONTRASENA)
  })

  describe('crearCuenta', () => {
    it('guarda la huella de la contraseña, nunca la contraseña', async () => {
      const dependencias = crearDependenciasFalsas(null)
      const servicio = crearServicioAutenticacion(dependencias)

      await servicio.crearCuenta({
        nombre: 'Ana',
        correo: 'ana@ejemplo.com',
        contrasena: CONTRASENA,
      })

      const datos = dependencias.crearUsuario.mock.calls[0]?.[0]
      expect(datos.nombre).toBe('Ana')
      expect(datos.correo).toBe('ana@ejemplo.com')
      expect(datos.contrasenaHash).toMatch(/^scrypt\$/)
      expect(datos.contrasenaHash).not.toContain(CONTRASENA)
    })

    it('termina igual aunque el correo ya exista', async () => {
      const dependencias = crearDependenciasFalsas(null)
      dependencias.crearUsuario.mockResolvedValue({
        creado: false,
        motivo: 'correo_repetido',
      })
      const servicio = crearServicioAutenticacion(dependencias)

      await expect(
        servicio.crearCuenta({
          nombre: 'Ana',
          correo: 'ana@ejemplo.com',
          contrasena: CONTRASENA,
        }),
      ).resolves.toBeUndefined()
    })
  })

  describe('entrar', () => {
    it('correo que no existe: credenciales inválidas, sin sesión ni intentos', async () => {
      const dependencias = crearDependenciasFalsas(null)
      const servicio = crearServicioAutenticacion(dependencias)

      expect(await servicio.entrar(datosEntrar)).toEqual({
        ok: false,
        motivo: 'credenciales_invalidas',
      })
      expect(dependencias.iniciarSesion).not.toHaveBeenCalled()
      expect(dependencias.registrarIntentoFallido).not.toHaveBeenCalled()
    })

    it('contraseña incorrecta: registra un intento fallido', async () => {
      const dependencias = crearDependenciasFalsas(crearUsuarioFalso())
      const servicio = crearServicioAutenticacion(dependencias)

      expect(await servicio.entrar(datosIncorrectos)).toEqual({
        ok: false,
        motivo: 'credenciales_invalidas',
      })
      expect(dependencias.registrarIntentoFallido).toHaveBeenCalledWith(
        5,
        seguridad.bloqueo.intentosMaximos,
        seguridad.bloqueo.duracionMs,
      )
      expect(dependencias.iniciarSesion).not.toHaveBeenCalled()
    })

    it('contraseña correcta y cuenta aprobada: crea la sesión y no devuelve la huella', async () => {
      const dependencias = crearDependenciasFalsas(crearUsuarioFalso())
      const servicio = crearServicioAutenticacion(dependencias)

      const resultado = await servicio.entrar(datosEntrar)

      expect(resultado).toEqual({
        ok: true,
        token: 'token-de-prueba',
        usuario: {
          id: 5,
          nombre: 'Ana',
          correo: 'ana@ejemplo.com',
          rol: 'usuario',
        },
      })
      expect(dependencias.iniciarSesion).toHaveBeenCalledWith(5)
      expect(dependencias.limpiarIntentos).not.toHaveBeenCalled()
    })

    it('contraseña correcta tras intentos fallidos: limpia el contador', async () => {
      const dependencias = crearDependenciasFalsas(
        crearUsuarioFalso({ intentosFallidos: 2 }),
      )
      const servicio = crearServicioAutenticacion(dependencias)

      expect((await servicio.entrar(datosEntrar)).ok).toBe(true)
      expect(dependencias.limpiarIntentos).toHaveBeenCalledWith(5)
    })

    it('cuenta bloqueada: no entra ni con la contraseña correcta', async () => {
      const bloqueadoHasta = new Date(AHORA + 60_000)
      const dependencias = crearDependenciasFalsas(
        crearUsuarioFalso({ bloqueadoHasta }),
      )
      const servicio = crearServicioAutenticacion(dependencias)

      expect(await servicio.entrar(datosEntrar)).toEqual({
        ok: false,
        motivo: 'bloqueada',
      })
      expect(dependencias.iniciarSesion).not.toHaveBeenCalled()
      expect(dependencias.registrarIntentoFallido).not.toHaveBeenCalled()
    })

    it('bloqueo ya vencido: entra y limpia el bloqueo viejo', async () => {
      const bloqueadoHasta = new Date(AHORA - 60_000)
      const dependencias = crearDependenciasFalsas(
        crearUsuarioFalso({ bloqueadoHasta }),
      )
      const servicio = crearServicioAutenticacion(dependencias)

      expect((await servicio.entrar(datosEntrar)).ok).toBe(true)
      expect(dependencias.limpiarIntentos).toHaveBeenCalledWith(5)
    })

    it('cuenta pendiente: el estado solo se revela con la contraseña correcta', async () => {
      const dependencias = crearDependenciasFalsas(
        crearUsuarioFalso({ estado: 'pendiente' }),
      )
      const servicio = crearServicioAutenticacion(dependencias)

      expect(await servicio.entrar(datosEntrar)).toEqual({
        ok: false,
        motivo: 'pendiente',
      })
      expect(await servicio.entrar(datosIncorrectos)).toEqual({
        ok: false,
        motivo: 'credenciales_invalidas',
      })
      expect(dependencias.iniciarSesion).not.toHaveBeenCalled()
    })

    it('cuenta rechazada: el estado solo se revela con la contraseña correcta', async () => {
      const dependencias = crearDependenciasFalsas(
        crearUsuarioFalso({ estado: 'rechazado' }),
      )
      const servicio = crearServicioAutenticacion(dependencias)

      expect(await servicio.entrar(datosEntrar)).toEqual({
        ok: false,
        motivo: 'rechazada',
      })
      expect(await servicio.entrar(datosIncorrectos)).toEqual({
        ok: false,
        motivo: 'credenciales_invalidas',
      })
      expect(dependencias.iniciarSesion).not.toHaveBeenCalled()
    })
  })
})
