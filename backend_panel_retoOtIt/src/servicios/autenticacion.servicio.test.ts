import { beforeAll, describe, expect, it, vi } from 'vitest'
import { seguridad } from '../configuracion/seguridad'
import type { Usuario } from '../repositorios/usuarios.repositorio'
import { crearHuella } from '../utilidades/contrasenas'
import { crearServicioAutenticacion } from './autenticacion.servicio'

const AHORA = Date.parse('2026-10-28T20:00:00Z')
const CONTRASENA = 'una-clave-larga-1'
const IP = '203.0.113.7'
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
    registrarEvento: vi.fn().mockResolvedValue(undefined),
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

      await servicio.crearCuenta(
        {
          nombre: 'Ana',
          correo: 'ana@ejemplo.com',
          contrasena: CONTRASENA,
        },
        IP,
      )

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
        servicio.crearCuenta(
          {
            nombre: 'Ana',
            correo: 'ana@ejemplo.com',
            contrasena: CONTRASENA,
          },
          IP,
        ),
      ).resolves.toBeUndefined()
    })
  })

  describe('entrar', () => {
    it('correo que no existe: credenciales inválidas, sin sesión ni intentos', async () => {
      const dependencias = crearDependenciasFalsas(null)
      const servicio = crearServicioAutenticacion(dependencias)

      expect(await servicio.entrar(datosEntrar, IP)).toEqual({
        ok: false,
        motivo: 'credenciales_invalidas',
      })
      expect(dependencias.iniciarSesion).not.toHaveBeenCalled()
      expect(dependencias.registrarIntentoFallido).not.toHaveBeenCalled()
    })

    it('contraseña incorrecta: registra un intento fallido', async () => {
      const dependencias = crearDependenciasFalsas(crearUsuarioFalso())
      const servicio = crearServicioAutenticacion(dependencias)

      expect(await servicio.entrar(datosIncorrectos, IP)).toEqual({
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

      const resultado = await servicio.entrar(datosEntrar, IP)

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

      expect((await servicio.entrar(datosEntrar, IP)).ok).toBe(true)
      expect(dependencias.limpiarIntentos).toHaveBeenCalledWith(5)
    })

    it('cuenta bloqueada: no entra ni con la contraseña correcta', async () => {
      const bloqueadoHasta = new Date(AHORA + 60_000)
      const dependencias = crearDependenciasFalsas(
        crearUsuarioFalso({ bloqueadoHasta }),
      )
      const servicio = crearServicioAutenticacion(dependencias)

      expect(await servicio.entrar(datosEntrar, IP)).toEqual({
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

      expect((await servicio.entrar(datosEntrar, IP)).ok).toBe(true)
      expect(dependencias.limpiarIntentos).toHaveBeenCalledWith(5)
    })

    it('cuenta pendiente: el estado solo se revela con la contraseña correcta', async () => {
      const dependencias = crearDependenciasFalsas(
        crearUsuarioFalso({ estado: 'pendiente' }),
      )
      const servicio = crearServicioAutenticacion(dependencias)

      expect(await servicio.entrar(datosEntrar, IP)).toEqual({
        ok: false,
        motivo: 'pendiente',
      })
      expect(await servicio.entrar(datosIncorrectos, IP)).toEqual({
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

      expect(await servicio.entrar(datosEntrar, IP)).toEqual({
        ok: false,
        motivo: 'rechazada',
      })
      expect(await servicio.entrar(datosIncorrectos, IP)).toEqual({
        ok: false,
        motivo: 'credenciales_invalidas',
      })
      expect(dependencias.iniciarSesion).not.toHaveBeenCalled()
    })
  })

  describe('bitácora', () => {
    const eventoDe = (d: ReturnType<typeof crearDependenciasFalsas>) =>
      d.registrarEvento.mock.calls.map((c) => c[0])

    it('entrada correcta: anota quién y desde dónde', async () => {
      const dependencias = crearDependenciasFalsas(crearUsuarioFalso())
      await crearServicioAutenticacion(dependencias).entrar(datosEntrar, IP)
      expect(eventoDe(dependencias)).toEqual([
        {
          tipo: 'entrada_correcta',
          usuarioId: 5,
          correo: 'ana@ejemplo.com',
          ip: IP,
        },
      ])
    })

    it('correo que no existe: anota el intento sin usuario', async () => {
      const dependencias = crearDependenciasFalsas(null)
      await crearServicioAutenticacion(dependencias).entrar(datosEntrar, IP)
      expect(eventoDe(dependencias)).toEqual([
        { tipo: 'entrada_fallida', correo: 'ana@ejemplo.com', ip: IP },
      ])
    })

    it('contraseña incorrecta: anota el fallo y no el bloqueo si faltan intentos', async () => {
      const dependencias = crearDependenciasFalsas(crearUsuarioFalso())
      await crearServicioAutenticacion(dependencias).entrar(
        datosIncorrectos,
        IP,
      )
      expect(eventoDe(dependencias).map((e) => e.tipo)).toEqual([
        'entrada_fallida',
      ])
    })

    it('el intento que llena el contador anota también el bloqueo', async () => {
      const dependencias = crearDependenciasFalsas(
        crearUsuarioFalso({
          intentosFallidos: seguridad.bloqueo.intentosMaximos - 1,
        }),
      )
      await crearServicioAutenticacion(dependencias).entrar(
        datosIncorrectos,
        IP,
      )
      expect(eventoDe(dependencias).map((e) => e.tipo)).toEqual([
        'entrada_fallida',
        'cuenta_bloqueada',
      ])
    })

    it('cuenta bloqueada: anota el intento mientras dura el bloqueo', async () => {
      const dependencias = crearDependenciasFalsas(
        crearUsuarioFalso({ bloqueadoHasta: new Date(AHORA + 60_000) }),
      )
      await crearServicioAutenticacion(dependencias).entrar(datosEntrar, IP)
      expect(eventoDe(dependencias).map((e) => e.tipo)).toEqual([
        'entrada_bloqueada',
      ])
    })

    it.each([
      ['pendiente', 'entrada_pendiente'],
      ['rechazado', 'entrada_rechazada'],
    ] as const)('cuenta %s: anota %s', async (estado, tipo) => {
      const dependencias = crearDependenciasFalsas(
        crearUsuarioFalso({ estado }),
      )
      await crearServicioAutenticacion(dependencias).entrar(datosEntrar, IP)
      expect(eventoDe(dependencias).map((e) => e.tipo)).toEqual([tipo])
    })

    it('cuenta nueva: anota la solicitud', async () => {
      const dependencias = crearDependenciasFalsas(null)
      await crearServicioAutenticacion(dependencias).crearCuenta(
        { nombre: 'Ana', correo: 'ana@ejemplo.com', contrasena: CONTRASENA },
        IP,
      )
      expect(eventoDe(dependencias)).toEqual([
        {
          tipo: 'cuenta_solicitada',
          usuarioId: 5,
          correo: 'ana@ejemplo.com',
          ip: IP,
        },
      ])
    })

    it('correo repetido: anota la solicitud repetida', async () => {
      const dependencias = crearDependenciasFalsas(null)
      dependencias.crearUsuario.mockResolvedValue({
        creado: false,
        motivo: 'correo_repetido',
      })
      await crearServicioAutenticacion(dependencias).crearCuenta(
        { nombre: 'Ana', correo: 'ana@ejemplo.com', contrasena: CONTRASENA },
        IP,
      )
      expect(eventoDe(dependencias)).toEqual([
        { tipo: 'solicitud_repetida', correo: 'ana@ejemplo.com', ip: IP },
      ])
    })
  })
})
