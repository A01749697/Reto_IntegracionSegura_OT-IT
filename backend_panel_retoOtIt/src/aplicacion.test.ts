import request from 'supertest'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { crearAplicacion } from './aplicacion'
import { seguridad } from './configuracion/seguridad'
import type { SesionActiva } from './repositorios/sesiones.repositorio'
import type { Usuario } from './repositorios/usuarios.repositorio'
import { crearHuella } from './utilidades/contrasenas'
import { calcularHuellaToken } from './utilidades/tokens'

const ORIGEN = 'https://18.119.219.73'
const AHORA = Date.parse('2026-10-28T20:00:00Z')
const CONTRASENA = 'una-clave-larga-1'
const TOKEN_SESION = 'a1b2c3d4'.repeat(8)
const COOKIE = `${seguridad.sesion.nombreCookie}=${TOKEN_SESION}`
const TOKEN_ENLACE = 'e5f6a7b8'.repeat(8)
let huella = ''

const sesionUsuario: SesionActiva = {
  sesionId: 10,
  usuarioId: 3,
  nombre: 'Ana',
  correo: 'ana@ejemplo.com',
  rol: 'usuario',
}
const sesionAdministrador: SesionActiva = {
  sesionId: 11,
  usuarioId: 1,
  nombre: 'Admin',
  correo: 'admin@ejemplo.com',
  rol: 'administrador',
}

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

function prepararApp() {
  const sesion = {
    crearSesion: vi.fn().mockResolvedValue(undefined),
    buscarSesionActiva: vi.fn().mockResolvedValue(null),
    revocarSesion: vi.fn().mockResolvedValue(undefined),
    revocarSesionesDeUsuario: vi.fn().mockResolvedValue(undefined),
    revocarOtrasSesiones: vi.fn().mockResolvedValue(undefined),
  }
  const autenticacion = {
    crearUsuario: vi.fn().mockResolvedValue({ creado: true, id: 5 }),
    buscarPorCorreo: vi.fn().mockResolvedValue(null),
    registrarIntentoFallido: vi.fn().mockResolvedValue(undefined),
    limpiarIntentos: vi.fn().mockResolvedValue(undefined),
  }
  const reinicio = {
    buscarPorCorreo: vi.fn().mockResolvedValue(null),
    invalidarEnlacesPendientes: vi.fn().mockResolvedValue(undefined),
    crearEnlace: vi.fn().mockResolvedValue(undefined),
    consumirEnlace: vi.fn().mockResolvedValue(null),
    cambiarContrasena: vi.fn().mockResolvedValue(undefined),
  }
  const administracion = {
    listarPorEstado: vi.fn().mockResolvedValue([]),
    buscarPorId: vi.fn().mockResolvedValue(null),
    cambiarEstado: vi.fn().mockResolvedValue(true),
    cambiarRol: vi.fn().mockResolvedValue(true),
    limpiarIntentos: vi.fn().mockResolvedValue(undefined),
  }
  const cuenta = {
    buscarPorId: vi.fn().mockResolvedValue(null),
    registrarIntentoFallido: vi.fn().mockResolvedValue(undefined),
    cambiarContrasena: vi.fn().mockResolvedValue(undefined),
  }
  const lecturas = {
    obtenerUltimasLecturas: vi.fn().mockResolvedValue([]),
    obtenerHistorial: vi
      .fn()
      .mockResolvedValue({ puntos: [], truncado: false }),
  }
  const bitacora = {
    insertarEvento: vi.fn().mockResolvedValue(undefined),
    listarEventos: vi.fn().mockResolvedValue([]),
  }
  const datos = {
    leerTabla: vi.fn().mockResolvedValue([]),
  }
  const sistema = {
    comprobarBasePanel: vi.fn().mockResolvedValue(undefined),
    obtenerEstadoLecturas: vi.fn().mockResolvedValue([]),
    obtenerActividadLecturas: vi.fn().mockResolvedValue({
      ahora: new Date('2026-11-12T12:07:00.000Z'),
      primera: new Date('2026-11-12T11:00:00.000Z'),
      cubetas: [{ inicio: new Date('2026-11-12T11:00:00.000Z'), lecturas: 3 }],
    }),
    obtenerTamanosBase: vi
      .fn()
      .mockResolvedValue({ totalBytes: 9000000, lecturasBytes: 4000000 }),
    leerDisco: vi
      .fn()
      .mockResolvedValue({ totalBytes: 8000000000, usadoBytes: 3000000000 }),
    leerMemoria: vi.fn().mockResolvedValue({
      totalBytes: 2000000000,
      disponibleBytes: 900000000,
      swapTotalBytes: 1000000000,
      swapUsadoBytes: 0,
    }),
    leerCpu: vi
      .fn()
      .mockReturnValue({ nucleos: 1, carga1: 0.2, carga5: 0.1, carga15: 0.1 }),
    leerVencimientoCertificado: vi
      .fn()
      .mockResolvedValue(new Date('2026-12-18T00:00:00.000Z')),
    comprobarApiReceptora: vi.fn().mockResolvedValue(undefined),
  }
  const correo = {
    remitente: 'panel@ejemplo.com',
    enviar: vi.fn().mockResolvedValue(undefined),
  }
  const app = crearAplicacion({
    urlPublica: ORIGEN,
    sesion,
    autenticacion,
    reinicio,
    administracion,
    cuenta,
    lecturas,
    bitacora,
    datos,
    sistema,
    correo,
    ahora: () => AHORA,
  })
  return {
    app,
    sesion,
    autenticacion,
    reinicio,
    administracion,
    cuenta,
    lecturas,
    bitacora,
    datos,
    sistema,
    correo,
  }
}

// Peticiones como las haría la página: con el Origin propio.
function publicar(app: ReturnType<typeof prepararApp>['app'], ruta: string) {
  return request(app).post(`/api/panel${ruta}`).set('Origin', ORIGEN)
}
function consultar(app: ReturnType<typeof prepararApp>['app'], ruta: string) {
  return request(app).get(`/api/panel${ruta}`)
}

const filtrosHistorial =
  'plc=S7-1500&variable=contador_piezas&desde=2026-10-28T16:00:00Z&hasta=2026-10-28T17:00:00Z'

beforeAll(async () => {
  huella = await crearHuella(CONTRASENA)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// Cada huella tarda una fracción de segundo a propósito; se da más margen de tiempo.
describe('API del panel', { timeout: 20000 }, () => {
  describe('GET /api/panel/salud', () => {
    it('responde ok sin sesión ni Origin y no anuncia Express', async () => {
      const { app } = prepararApp()
      const respuesta = await consultar(app, '/salud')
      expect(respuesta.status).toBe(200)
      expect(respuesta.body).toEqual({ estado: 'ok' })
      expect(respuesta.headers['x-powered-by']).toBeUndefined()
    })
  })

  describe('revisión de Origin', () => {
    it('rechaza un POST sin Origin y no consulta la base', async () => {
      const { app, autenticacion } = prepararApp()
      const respuesta = await request(app)
        .post('/api/panel/autenticacion/entrar')
        .send({ correo: 'ana@ejemplo.com', contrasena: CONTRASENA })
      expect(respuesta.status).toBe(403)
      expect(autenticacion.buscarPorCorreo).not.toHaveBeenCalled()
    })

    it('rechaza un POST con el Origin de otro sitio', async () => {
      const { app, autenticacion } = prepararApp()
      const respuesta = await request(app)
        .post('/api/panel/autenticacion/entrar')
        .set('Origin', 'https://sitio-malo.com')
        .send({ correo: 'ana@ejemplo.com', contrasena: CONTRASENA })
      expect(respuesta.status).toBe(403)
      expect(autenticacion.buscarPorCorreo).not.toHaveBeenCalled()
    })
  })

  describe('POST /autenticacion/cuenta', () => {
    const cuerpo = {
      nombre: 'Ana',
      correo: 'Ana@Ejemplo.com',
      contrasena: CONTRASENA,
    }

    it('responde 202 y guarda la huella, no la contraseña', async () => {
      const { app, autenticacion } = prepararApp()
      const respuesta = await publicar(app, '/autenticacion/cuenta').send(
        cuerpo,
      )

      expect(respuesta.status).toBe(202)
      const datos = autenticacion.crearUsuario.mock.calls[0]?.[0]
      expect(datos.correo).toBe('ana@ejemplo.com')
      expect(datos.contrasenaHash).toMatch(/^scrypt\$/)
      expect(JSON.stringify(datos)).not.toContain(CONTRASENA)
    })

    it('responde exactamente lo mismo si el correo ya existe', async () => {
      const nueva = prepararApp()
      const repetida = prepararApp()
      repetida.autenticacion.crearUsuario.mockResolvedValue({
        creado: false,
        motivo: 'correo_repetido',
      })

      const a = await publicar(nueva.app, '/autenticacion/cuenta').send(cuerpo)
      const b = await publicar(repetida.app, '/autenticacion/cuenta').send(
        cuerpo,
      )

      expect(b.status).toBe(a.status)
      expect(b.body).toEqual(a.body)
    })

    it.each([
      ['un campo extra (rol)', { ...cuerpo, rol: 'administrador' }],
      ['una contraseña corta', { ...cuerpo, contrasena: 'corta' }],
      ['un correo inválido', { ...cuerpo, correo: 'sin-arroba' }],
      ['un nombre vacío', { ...cuerpo, nombre: '  ' }],
    ])('responde 400 y no guarda nada con %s', async (_nombre, enviado) => {
      const { app, autenticacion } = prepararApp()
      const respuesta = await publicar(app, '/autenticacion/cuenta').send(
        enviado,
      )
      expect(respuesta.status).toBe(400)
      expect(autenticacion.crearUsuario).not.toHaveBeenCalled()
    })
  })

  describe('POST /autenticacion/entrar', () => {
    const credenciales = { correo: 'ana@ejemplo.com', contrasena: CONTRASENA }

    it('con credenciales correctas responde 200 y pone la cookie protegida', async () => {
      const { app, autenticacion, sesion } = prepararApp()
      autenticacion.buscarPorCorreo.mockResolvedValue(crearUsuarioFalso())

      const respuesta = await publicar(app, '/autenticacion/entrar').send(
        credenciales,
      )

      expect(respuesta.status).toBe(200)
      expect(respuesta.body).toEqual({
        usuario: {
          id: 5,
          nombre: 'Ana',
          correo: 'ana@ejemplo.com',
          rol: 'usuario',
        },
      })
      expect(JSON.stringify(respuesta.body)).not.toContain('scrypt')

      const cookie = respuesta.headers['set-cookie']?.[0] ?? ''
      expect(cookie).toContain(`${seguridad.sesion.nombreCookie}=`)
      expect(cookie).toContain('HttpOnly')
      expect(cookie).toContain('Secure')
      expect(cookie).toContain('SameSite=Strict')

      // En la base solo se guarda la huella del código que viajó en la cookie.
      const codigo = cookie.split(';')[0]?.split('=')[1] ?? ''
      expect(codigo).toMatch(/^[0-9a-f]{64}$/)
      expect(sesion.crearSesion).toHaveBeenCalledWith(
        5,
        calcularHuellaToken(codigo),
        seguridad.sesion.duracionMaximaMs,
      )
    })

    it('con contraseña incorrecta responde 401 sin cookie y cuenta el intento', async () => {
      const { app, autenticacion } = prepararApp()
      autenticacion.buscarPorCorreo.mockResolvedValue(crearUsuarioFalso())

      const respuesta = await publicar(app, '/autenticacion/entrar').send({
        ...credenciales,
        contrasena: 'otra-clave-1234',
      })

      expect(respuesta.status).toBe(401)
      expect(respuesta.headers['set-cookie']).toBeUndefined()
      expect(autenticacion.registrarIntentoFallido).toHaveBeenCalled()
    })

    it('responde lo mismo con un correo que no existe y con una contraseña incorrecta', async () => {
      const existente = prepararApp()
      existente.autenticacion.buscarPorCorreo.mockResolvedValue(
        crearUsuarioFalso(),
      )
      const inexistente = prepararApp()

      const a = await publicar(existente.app, '/autenticacion/entrar').send({
        ...credenciales,
        contrasena: 'otra-clave-1234',
      })
      const b = await publicar(inexistente.app, '/autenticacion/entrar').send(
        credenciales,
      )

      expect(b.status).toBe(a.status)
      expect(b.body).toEqual(a.body)
    })

    it('cuenta pendiente: el estado solo se revela con la contraseña correcta', async () => {
      const { app, autenticacion } = prepararApp()
      autenticacion.buscarPorCorreo.mockResolvedValue(
        crearUsuarioFalso({ estado: 'pendiente' }),
      )

      const correcta = await publicar(app, '/autenticacion/entrar').send(
        credenciales,
      )
      expect(correcta.status).toBe(403)
      expect(correcta.body.codigo).toBe('pendiente')
      expect(correcta.headers['set-cookie']).toBeUndefined()

      const incorrecta = await publicar(app, '/autenticacion/entrar').send({
        ...credenciales,
        contrasena: 'otra-clave-1234',
      })
      expect(incorrecta.status).toBe(401)
    })

    it('cuenta rechazada: responde 403 con la contraseña correcta', async () => {
      const { app, autenticacion } = prepararApp()
      autenticacion.buscarPorCorreo.mockResolvedValue(
        crearUsuarioFalso({ estado: 'rechazado' }),
      )
      const respuesta = await publicar(app, '/autenticacion/entrar').send(
        credenciales,
      )
      expect(respuesta.status).toBe(403)
      expect(respuesta.body.codigo).toBe('rechazada')
    })

    it('cuenta bloqueada: responde 429 aunque la contraseña sea correcta', async () => {
      const { app, autenticacion, sesion } = prepararApp()
      autenticacion.buscarPorCorreo.mockResolvedValue(
        crearUsuarioFalso({ bloqueadoHasta: new Date(AHORA + 60_000) }),
      )
      const respuesta = await publicar(app, '/autenticacion/entrar').send(
        credenciales,
      )
      expect(respuesta.status).toBe(429)
      expect(respuesta.body.codigo).toBe('bloqueada')
      expect(sesion.crearSesion).not.toHaveBeenCalled()
    })

    it('responde 400 con un campo de más', async () => {
      const { app } = prepararApp()
      const respuesta = await publicar(app, '/autenticacion/entrar').send({
        ...credenciales,
        recordarme: true,
      })
      expect(respuesta.status).toBe(400)
    })
  })

  describe('POST /autenticacion/olvide', () => {
    it('responde igual exista o no el correo, y solo envía correo si existe', async () => {
      const existente = prepararApp()
      existente.reinicio.buscarPorCorreo.mockResolvedValue(crearUsuarioFalso())
      const inexistente = prepararApp()
      const cuerpo = { correo: 'ana@ejemplo.com' }

      const a = await publicar(existente.app, '/autenticacion/olvide').send(
        cuerpo,
      )
      const b = await publicar(inexistente.app, '/autenticacion/olvide').send(
        cuerpo,
      )

      expect(a.status).toBe(202)
      expect(b.status).toBe(202)
      expect(b.body).toEqual(a.body)

      await vi.waitFor(() => expect(existente.correo.enviar).toHaveBeenCalled())
      const correo = existente.correo.enviar.mock.calls[0]?.[0]
      expect(correo.Destination.ToAddresses).toEqual(['ana@ejemplo.com'])
      expect(inexistente.correo.enviar).not.toHaveBeenCalled()
    })

    it('responde 202 aunque el envío del correo falle', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const { app, reinicio, correo } = prepararApp()
      reinicio.buscarPorCorreo.mockResolvedValue(crearUsuarioFalso())
      correo.enviar.mockRejectedValue(new Error('SES no responde'))

      const respuesta = await publicar(app, '/autenticacion/olvide').send({
        correo: 'ana@ejemplo.com',
      })
      expect(respuesta.status).toBe(202)
    })

    it('responde 400 con un correo mal escrito', async () => {
      const { app } = prepararApp()
      const respuesta = await publicar(app, '/autenticacion/olvide').send({
        correo: 'sin-arroba',
      })
      expect(respuesta.status).toBe(400)
    })
  })

  describe('POST /autenticacion/restablecer', () => {
    it('con un enlace válido cambia la contraseña y cierra las sesiones', async () => {
      const { app, reinicio, sesion } = prepararApp()
      reinicio.consumirEnlace.mockResolvedValue(5)

      const respuesta = await publicar(app, '/autenticacion/restablecer').send({
        token: TOKEN_ENLACE,
        contrasena: 'una-clave-nueva-1',
      })

      expect(respuesta.status).toBe(200)
      expect(reinicio.consumirEnlace).toHaveBeenCalledWith(
        calcularHuellaToken(TOKEN_ENLACE),
      )
      expect(reinicio.cambiarContrasena.mock.calls[0]?.[0]).toBe(5)
      expect(sesion.revocarSesionesDeUsuario).toHaveBeenCalledWith(5)
    })

    it('con un enlace que no sirve responde 400 y no cambia nada', async () => {
      const { app, reinicio } = prepararApp()
      const respuesta = await publicar(app, '/autenticacion/restablecer').send({
        token: TOKEN_ENLACE,
        contrasena: 'una-clave-nueva-1',
      })
      expect(respuesta.status).toBe(400)
      expect(reinicio.cambiarContrasena).not.toHaveBeenCalled()
    })

    it('con un código de forma inválida responde 400 sin consultar la base', async () => {
      const { app, reinicio } = prepararApp()
      const respuesta = await publicar(app, '/autenticacion/restablecer').send({
        token: 'basura',
        contrasena: 'una-clave-nueva-1',
      })
      expect(respuesta.status).toBe(400)
      expect(reinicio.consumirEnlace).not.toHaveBeenCalled()
    })

    it('con una contraseña nueva demasiado corta responde 400', async () => {
      const { app, reinicio } = prepararApp()
      const respuesta = await publicar(app, '/autenticacion/restablecer').send({
        token: TOKEN_ENLACE,
        contrasena: 'corta',
      })
      expect(respuesta.status).toBe(400)
      expect(reinicio.consumirEnlace).not.toHaveBeenCalled()
    })
  })

  describe('GET /autenticacion/yo y POST /autenticacion/salir', () => {
    it('yo responde 401 sin cookie', async () => {
      const { app } = prepararApp()
      const respuesta = await consultar(app, '/autenticacion/yo')
      expect(respuesta.status).toBe(401)
    })

    it('yo responde los datos de la persona con una sesión válida y sin caché', async () => {
      const { app, sesion } = prepararApp()
      sesion.buscarSesionActiva.mockResolvedValue(sesionUsuario)

      const respuesta = await consultar(app, '/autenticacion/yo').set(
        'Cookie',
        COOKIE,
      )

      expect(respuesta.status).toBe(200)
      expect(respuesta.body).toEqual({
        usuario: {
          id: 3,
          nombre: 'Ana',
          correo: 'ana@ejemplo.com',
          rol: 'usuario',
        },
      })
      expect(respuesta.headers['cache-control']).toBe('no-store')
      expect(sesion.buscarSesionActiva).toHaveBeenCalledWith(
        calcularHuellaToken(TOKEN_SESION),
        seguridad.sesion.inactividadMaximaMs,
      )
    })

    it('yo responde 401 si la sesión no sirve (caducada, revocada o cuenta rechazada)', async () => {
      const { app } = prepararApp()
      const respuesta = await consultar(app, '/autenticacion/yo').set(
        'Cookie',
        COOKIE,
      )
      expect(respuesta.status).toBe(401)
    })

    it('yo responde 401 con una cookie de forma inválida sin consultar la base', async () => {
      const { app, sesion } = prepararApp()
      const respuesta = await consultar(app, '/autenticacion/yo').set(
        'Cookie',
        `${seguridad.sesion.nombreCookie}=basura`,
      )
      expect(respuesta.status).toBe(401)
      expect(sesion.buscarSesionActiva).not.toHaveBeenCalled()
    })

    it('salir revoca la sesión y borra la cookie', async () => {
      const { app, sesion } = prepararApp()
      const respuesta = await publicar(app, '/autenticacion/salir').set(
        'Cookie',
        COOKIE,
      )

      expect(respuesta.status).toBe(204)
      expect(sesion.revocarSesion).toHaveBeenCalledWith(
        calcularHuellaToken(TOKEN_SESION),
      )
      expect(respuesta.headers['set-cookie']?.[0]).toContain('Max-Age=0')
    })

    it('salir sin cookie también responde 204', async () => {
      const { app, sesion } = prepararApp()
      const respuesta = await publicar(app, '/autenticacion/salir')
      expect(respuesta.status).toBe(204)
      expect(sesion.revocarSesion).not.toHaveBeenCalled()
    })
  })

  describe('administración', () => {
    it('sin sesión responde 401', async () => {
      const { app } = prepararApp()
      const respuesta = await consultar(app, '/administracion/usuarios')
      expect(respuesta.status).toBe(401)
    })

    it('un usuario normal recibe 403 y no puede decidir sobre nadie', async () => {
      const { app, sesion, administracion } = prepararApp()
      sesion.buscarSesionActiva.mockResolvedValue(sesionUsuario)

      const lista = await consultar(app, '/administracion/usuarios').set(
        'Cookie',
        COOKIE,
      )
      expect(lista.status).toBe(403)

      const decision = await publicar(
        app,
        '/administracion/usuarios/5/decision',
      )
        .set('Cookie', COOKIE)
        .send({ decision: 'aprobado' })
      expect(decision.status).toBe(403)
      expect(administracion.cambiarEstado).not.toHaveBeenCalled()
    })

    it('un administrador lista las cuentas pendientes por defecto', async () => {
      const { app, sesion, administracion } = prepararApp()
      sesion.buscarSesionActiva.mockResolvedValue(sesionAdministrador)

      const respuesta = await consultar(app, '/administracion/usuarios').set(
        'Cookie',
        COOKIE,
      )

      expect(respuesta.status).toBe(200)
      expect(respuesta.body).toEqual({ usuarios: [] })
      expect(administracion.listarPorEstado).toHaveBeenCalledWith('pendiente')
    })

    it('rechaza un estado que no existe con 400', async () => {
      const { app, sesion, administracion } = prepararApp()
      sesion.buscarSesionActiva.mockResolvedValue(sesionAdministrador)

      const respuesta = await consultar(
        app,
        '/administracion/usuarios?estado=otro',
      ).set('Cookie', COOKIE)
      expect(respuesta.status).toBe(400)
      expect(administracion.listarPorEstado).not.toHaveBeenCalled()
    })

    it('un administrador aprueba una cuenta y queda registrado quién decidió', async () => {
      const { app, sesion, administracion } = prepararApp()
      sesion.buscarSesionActiva.mockResolvedValue(sesionAdministrador)
      administracion.buscarPorId.mockResolvedValue(
        crearUsuarioFalso({ id: 5, estado: 'pendiente' }),
      )

      const respuesta = await publicar(
        app,
        '/administracion/usuarios/5/decision',
      )
        .set('Cookie', COOKIE)
        .send({ decision: 'aprobado' })

      expect(respuesta.status).toBe(200)
      expect(respuesta.body).toEqual({ mensaje: 'Cuenta aprobada' })
      expect(administracion.cambiarEstado).toHaveBeenCalledWith(
        5,
        'aprobado',
        1,
      )
    })

    it('al rechazar una cuenta se cierran sus sesiones', async () => {
      const { app, sesion, administracion } = prepararApp()
      sesion.buscarSesionActiva.mockResolvedValue(sesionAdministrador)
      administracion.buscarPorId.mockResolvedValue(
        crearUsuarioFalso({ id: 5, estado: 'aprobado' }),
      )

      const respuesta = await publicar(
        app,
        '/administracion/usuarios/5/decision',
      )
        .set('Cookie', COOKIE)
        .send({ decision: 'rechazado' })

      expect(respuesta.status).toBe(200)
      expect(sesion.revocarSesionesDeUsuario).toHaveBeenCalledWith(5)
    })

    it('nadie decide sobre su propia cuenta', async () => {
      const { app, sesion, administracion } = prepararApp()
      sesion.buscarSesionActiva.mockResolvedValue(sesionAdministrador)

      const respuesta = await publicar(
        app,
        '/administracion/usuarios/1/decision',
      )
        .set('Cookie', COOKIE)
        .send({ decision: 'rechazado' })

      expect(respuesta.status).toBe(403)
      expect(administracion.cambiarEstado).not.toHaveBeenCalled()
    })

    it.each([
      [
        'un número de cuenta inválido',
        '/administracion/usuarios/abc/decision',
        { decision: 'aprobado' },
      ],
      [
        'una decisión inválida',
        '/administracion/usuarios/5/decision',
        { decision: 'pendiente' },
      ],
      [
        'un campo de más',
        '/administracion/usuarios/5/decision',
        { decision: 'aprobado', rol: 'administrador' },
      ],
    ])('responde 400 con %s', async (_nombre, ruta, cuerpo) => {
      const { app, sesion, administracion } = prepararApp()
      sesion.buscarSesionActiva.mockResolvedValue(sesionAdministrador)

      const respuesta = await publicar(app, ruta)
        .set('Cookie', COOKIE)
        .send(cuerpo)

      expect(respuesta.status).toBe(400)
      expect(administracion.cambiarEstado).not.toHaveBeenCalled()
    })

    it('responde 404 si la cuenta no existe', async () => {
      const { app, sesion } = prepararApp()
      sesion.buscarSesionActiva.mockResolvedValue(sesionAdministrador)

      const respuesta = await publicar(
        app,
        '/administracion/usuarios/99/decision',
      )
        .set('Cookie', COOKIE)
        .send({ decision: 'aprobado' })

      expect(respuesta.status).toBe(404)
    })
  })

  describe('lecturas', () => {
    it('ultimas responde 401 sin sesión', async () => {
      const { app } = prepararApp()
      const respuesta = await consultar(app, '/lecturas/ultimas')
      expect(respuesta.status).toBe(401)
    })

    it('ultimas responde las lecturas con una sesión válida', async () => {
      const { app, sesion, lecturas } = prepararApp()
      sesion.buscarSesionActiva.mockResolvedValue(sesionUsuario)
      lecturas.obtenerUltimasLecturas.mockResolvedValue([
        {
          plc: 'S7-1500',
          variable: 'contador_piezas',
          valor: 42,
          ts: new Date('2026-10-28T16:00:00Z'),
        },
      ])

      const respuesta = await consultar(app, '/lecturas/ultimas').set(
        'Cookie',
        COOKIE,
      )

      expect(respuesta.status).toBe(200)
      expect(respuesta.body.lecturas).toEqual([
        {
          plc: 'S7-1500',
          variable: 'contador_piezas',
          valor: 42,
          ts: '2026-10-28T16:00:00.000Z',
        },
      ])
    })

    it('historial responde 401 sin sesión', async () => {
      const { app } = prepararApp()
      const respuesta = await consultar(
        app,
        `/lecturas/historial?${filtrosHistorial}`,
      )
      expect(respuesta.status).toBe(401)
    })

    it('historial consulta con el tope de puntos y devuelve el aviso de recorte', async () => {
      const { app, sesion, lecturas } = prepararApp()
      sesion.buscarSesionActiva.mockResolvedValue(sesionUsuario)
      lecturas.obtenerHistorial.mockResolvedValue({
        puntos: [{ ts: new Date('2026-10-28T16:30:00Z'), valor: 7 }],
        truncado: true,
      })

      const respuesta = await consultar(
        app,
        `/lecturas/historial?${filtrosHistorial}`,
      ).set('Cookie', COOKIE)

      expect(respuesta.status).toBe(200)
      expect(respuesta.body).toEqual({
        puntos: [{ ts: '2026-10-28T16:30:00.000Z', valor: 7 }],
        truncado: true,
      })
      expect(lecturas.obtenerHistorial).toHaveBeenCalledWith(
        expect.objectContaining({
          plc: 'S7-1500',
          variable: 'contador_piezas',
          limite: seguridad.lecturas.maximoPuntosHistorial,
        }),
      )
    })

    it('historial responde 400 con filtros inválidos y no consulta la base', async () => {
      const { app, sesion, lecturas } = prepararApp()
      sesion.buscarSesionActiva.mockResolvedValue(sesionUsuario)

      const respuesta = await consultar(
        app,
        `/lecturas/historial?plc=${encodeURIComponent("S7';--")}&variable=contador_piezas&desde=2026-10-28T16:00:00Z&hasta=2026-10-28T17:00:00Z`,
      ).set('Cookie', COOKIE)

      expect(respuesta.status).toBe(400)
      expect(lecturas.obtenerHistorial).not.toHaveBeenCalled()
    })
  })

  describe('bitácora', () => {
    const evento = {
      id: 9,
      ocurrioEn: new Date('2026-11-06T18:00:00Z'),
      tipo: 'entrada_fallida',
      usuarioId: null,
      correo: 'ana@ejemplo.com',
      ip: '203.0.113.7',
      actorCorreo: null,
    }

    it('sin sesión responde 401', async () => {
      const { app } = prepararApp()
      const respuesta = await consultar(app, '/administracion/bitacora')
      expect(respuesta.status).toBe(401)
    })

    it('un usuario normal recibe 403 y no se consulta la base', async () => {
      const { app, sesion, bitacora } = prepararApp()
      sesion.buscarSesionActiva.mockResolvedValue(sesionUsuario)

      const respuesta = await consultar(app, '/administracion/bitacora').set(
        'Cookie',
        COOKIE,
      )

      expect(respuesta.status).toBe(403)
      expect(bitacora.listarEventos).not.toHaveBeenCalled()
    })

    it('un administrador recibe los eventos y si hay más', async () => {
      const { app, sesion, bitacora } = prepararApp()
      sesion.buscarSesionActiva.mockResolvedValue(sesionAdministrador)
      bitacora.listarEventos.mockResolvedValue([evento])

      const respuesta = await consultar(
        app,
        '/administracion/bitacora?grupo=alertas&limite=5',
      ).set('Cookie', COOKIE)

      expect(respuesta.status).toBe(200)
      expect(respuesta.body).toEqual({
        eventos: [{ ...evento, ocurrioEn: '2026-11-06T18:00:00.000Z' }],
        hayMas: false,
      })
      expect(bitacora.listarEventos).toHaveBeenCalledWith(
        expect.objectContaining({ antes: null, limite: 6 }),
      )
    })

    it('responde 400 con un filtro inválido', async () => {
      const { app, sesion, bitacora } = prepararApp()
      sesion.buscarSesionActiva.mockResolvedValue(sesionAdministrador)

      const respuesta = await consultar(
        app,
        '/administracion/bitacora?grupo=otro',
      ).set('Cookie', COOKIE)

      expect(respuesta.status).toBe(400)
      expect(bitacora.listarEventos).not.toHaveBeenCalled()
    })

    // ---- Datos (solo lectura) ----
    describe('GET /administracion/datos', () => {
      const filaCuenta = {
        id: 4,
        nombre: 'Ana',
        correo: 'ana@ejemplo.com',
        rol: 'usuario',
        estado: 'aprobado',
        intentosFallidos: 0,
        bloqueadoHasta: null,
        creadoEn: new Date('2026-11-01T10:00:00Z'),
        aprobadoEn: null,
        aprobadoPor: null,
      }

      it('sin sesión responde 401 y con usuario normal 403, sin leer la base', async () => {
        const { app, sesion, datos } = prepararApp()
        expect((await consultar(app, '/administracion/datos')).status).toBe(401)
        expect(
          (await consultar(app, '/administracion/datos/cuentas')).status,
        ).toBe(401)

        sesion.buscarSesionActiva.mockResolvedValue(sesionUsuario)
        const sinPermiso = await consultar(
          app,
          '/administracion/datos/cuentas',
        ).set('Cookie', COOKIE)
        expect(sinPermiso.status).toBe(403)
        expect(datos.leerTabla).not.toHaveBeenCalled()
      })

      it('un administrador ve la lista de tablas', async () => {
        const { app, sesion } = prepararApp()
        sesion.buscarSesionActiva.mockResolvedValue(sesionAdministrador)

        const respuesta = await consultar(app, '/administracion/datos').set(
          'Cookie',
          COOKIE,
        )

        expect(respuesta.status).toBe(200)
        expect(respuesta.body.tablas.map((t: { id: string }) => t.id)).toEqual([
          'cuentas',
          'bitacora',
        ])
      })

      it('un administrador lee cuentas y queda anotado', async () => {
        const { app, sesion, datos, bitacora } = prepararApp()
        sesion.buscarSesionActiva.mockResolvedValue(sesionAdministrador)
        datos.leerTabla.mockResolvedValue([filaCuenta])

        const respuesta = await consultar(
          app,
          '/administracion/datos/cuentas?buscar=ana&limite=5',
        ).set('Cookie', COOKIE)

        expect(respuesta.status).toBe(200)
        expect(respuesta.body.hayMas).toBe(false)
        expect(respuesta.body.filas).toEqual([
          {
            ...filaCuenta,
            creadoEn: '2026-11-01T10:00:00.000Z',
          },
        ])
        expect(JSON.stringify(respuesta.body)).not.toMatch(/hash|contrasena/i)
        expect(datos.leerTabla).toHaveBeenCalledWith('cuentas', {
          buscar: 'ana',
          antes: null,
          limite: 6,
        })
        expect(bitacora.insertarEvento).toHaveBeenCalledWith(
          expect.objectContaining({
            tipo: 'datos_cuentas_consultadas',
            usuarioId: 1,
          }),
        )
      })

      it.each(['usuarios', 'sesiones', 'enlaces_reinicio', 'lecturas'])(
        'la tabla %s no se puede pedir (404) y no toca la base',
        async (tabla) => {
          const { app, sesion, datos } = prepararApp()
          sesion.buscarSesionActiva.mockResolvedValue(sesionAdministrador)

          const respuesta = await consultar(
            app,
            `/administracion/datos/${tabla}`,
          ).set('Cookie', COOKIE)

          expect(respuesta.status).toBe(404)
          expect(datos.leerTabla).not.toHaveBeenCalled()
        },
      )

      it('una consulta con campos raros responde 400', async () => {
        const { app, sesion, datos } = prepararApp()
        sesion.buscarSesionActiva.mockResolvedValue(sesionAdministrador)

        for (const consulta of [
          'columnas=contrasena_hash',
          'antes=abc',
          'limite=5000',
          'buscar=a&buscar=b',
        ]) {
          const respuesta = await consultar(
            app,
            `/administracion/datos/cuentas?${consulta}`,
          ).set('Cookie', COOKIE)
          expect(respuesta.status).toBe(400)
        }
        expect(datos.leerTabla).not.toHaveBeenCalled()
      })

      it('no hay forma de escribir: POST y DELETE no existen', async () => {
        const { app, sesion, datos } = prepararApp()
        sesion.buscarSesionActiva.mockResolvedValue(sesionAdministrador)

        const post = await publicar(app, '/administracion/datos/cuentas').set(
          'Cookie',
          COOKIE,
        )
        const borrar = await request(app)
          .delete('/api/panel/administracion/datos/cuentas')
          .set('Origin', ORIGEN)
          .set('Cookie', COOKIE)

        expect(post.status).toBe(404)
        expect(borrar.status).toBe(404)
        expect(datos.leerTabla).not.toHaveBeenCalled()
      })
    })

    it('un intento de entrada fallido queda anotado con la IP', async () => {
      const { app, bitacora } = prepararApp()

      await publicar(app, '/autenticacion/entrar').send({
        correo: 'ana@ejemplo.com',
        contrasena: CONTRASENA,
      })

      expect(bitacora.insertarEvento).toHaveBeenCalledTimes(1)
      const anotado = bitacora.insertarEvento.mock.calls[0]?.[0]
      expect(anotado).toMatchObject({
        tipo: 'entrada_fallida',
        correo: 'ana@ejemplo.com',
      })
      expect(anotado.ip).toEqual(expect.any(String))
    })

    it('si la bitácora falla, el inicio de sesión sigue funcionando', async () => {
      const { app, autenticacion, bitacora } = prepararApp()
      autenticacion.buscarPorCorreo.mockResolvedValue(crearUsuarioFalso())
      bitacora.insertarEvento.mockRejectedValue(new Error('caida'))
      vi.spyOn(console, 'error').mockImplementation(() => {})

      const respuesta = await publicar(app, '/autenticacion/entrar').send({
        correo: 'ana@ejemplo.com',
        contrasena: CONTRASENA,
      })

      expect(respuesta.status).toBe(200)
    })

    it('aprobar una cuenta anota quién la aprobó', async () => {
      const { app, sesion, administracion, bitacora } = prepararApp()
      sesion.buscarSesionActiva.mockResolvedValue(sesionAdministrador)
      administracion.buscarPorId.mockResolvedValue(
        crearUsuarioFalso({ id: 5, estado: 'pendiente' }),
      )

      await publicar(app, '/administracion/usuarios/5/decision')
        .set('Cookie', COOKIE)
        .send({ decision: 'aprobado' })

      expect(bitacora.insertarEvento).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'cuenta_aprobada',
          usuarioId: 5,
          actorId: sesionAdministrador.usuarioId,
        }),
      )
    })
  })

  describe('gestión de cuentas', () => {
    it('listar con estado=todas lo pasa a la base y devuelve si está bloqueada', async () => {
      const { app, sesion, administracion } = prepararApp()
      sesion.buscarSesionActiva.mockResolvedValue(sesionAdministrador)
      administracion.listarPorEstado.mockResolvedValue([
        {
          id: 5,
          nombre: 'Ana',
          correo: 'ana@ejemplo.com',
          rol: 'usuario',
          estado: 'aprobado',
          bloqueada: true,
          creadoEn: new Date('2026-10-28T16:00:00Z'),
        },
      ])

      const respuesta = await consultar(
        app,
        '/administracion/usuarios?estado=todas',
      ).set('Cookie', COOKIE)

      expect(respuesta.status).toBe(200)
      expect(respuesta.body.usuarios[0].bloqueada).toBe(true)
      expect(administracion.listarPorEstado).toHaveBeenCalledWith('todas')
    })

    it('desbloquear quita el bloqueo y lo anota con quién lo hizo', async () => {
      const { app, sesion, administracion, bitacora } = prepararApp()
      sesion.buscarSesionActiva.mockResolvedValue(sesionAdministrador)
      administracion.buscarPorId.mockResolvedValue(
        crearUsuarioFalso({ bloqueadoHasta: new Date(AHORA + 60_000) }),
      )

      const respuesta = await publicar(
        app,
        '/administracion/usuarios/5/desbloqueo',
      )
        .set('Cookie', COOKIE)
        .send()

      expect(respuesta.status).toBe(200)
      expect(administracion.limpiarIntentos).toHaveBeenCalledWith(5)
      expect(bitacora.insertarEvento).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'cuenta_desbloqueada',
          usuarioId: 5,
          actorId: sesionAdministrador.usuarioId,
        }),
      )
    })

    it('desbloquear una cuenta que no está bloqueada responde 409', async () => {
      const { app, sesion, administracion } = prepararApp()
      sesion.buscarSesionActiva.mockResolvedValue(sesionAdministrador)
      administracion.buscarPorId.mockResolvedValue(crearUsuarioFalso())

      const respuesta = await publicar(
        app,
        '/administracion/usuarios/5/desbloqueo',
      )
        .set('Cookie', COOKIE)
        .send()

      expect(respuesta.status).toBe(409)
      expect(administracion.limpiarIntentos).not.toHaveBeenCalled()
    })

    it('hacer administrador cambia el rol y lo anota', async () => {
      const { app, sesion, administracion, bitacora } = prepararApp()
      sesion.buscarSesionActiva.mockResolvedValue(sesionAdministrador)
      administracion.buscarPorId.mockResolvedValue(crearUsuarioFalso())

      const respuesta = await publicar(
        app,
        '/administracion/usuarios/5/administrador',
      )
        .set('Cookie', COOKIE)
        .send()

      expect(respuesta.status).toBe(200)
      expect(administracion.cambiarRol).toHaveBeenCalledWith(5, 'administrador')
      expect(bitacora.insertarEvento).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: 'rol_cambiado', usuarioId: 5 }),
      )
    })

    it.each([
      ['pendiente', 409],
      ['rechazado', 409],
    ] as const)('no promueve una cuenta %s', async (estado, codigo) => {
      const { app, sesion, administracion } = prepararApp()
      sesion.buscarSesionActiva.mockResolvedValue(sesionAdministrador)
      administracion.buscarPorId.mockResolvedValue(
        crearUsuarioFalso({ estado }),
      )

      const respuesta = await publicar(
        app,
        '/administracion/usuarios/5/administrador',
      )
        .set('Cookie', COOKIE)
        .send()

      expect(respuesta.status).toBe(codigo)
      expect(administracion.cambiarRol).not.toHaveBeenCalled()
    })

    it.each(['/desbloqueo', '/administrador'])(
      'un usuario normal recibe 403 en %s',
      async (ruta) => {
        const { app, sesion, administracion } = prepararApp()
        sesion.buscarSesionActiva.mockResolvedValue(sesionUsuario)

        const respuesta = await publicar(
          app,
          `/administracion/usuarios/5${ruta}`,
        )
          .set('Cookie', COOKIE)
          .send()

        expect(respuesta.status).toBe(403)
        expect(administracion.buscarPorId).not.toHaveBeenCalled()
      },
    )

    it('rechaza un número de cuenta inválido con 400', async () => {
      const { app, sesion } = prepararApp()
      sesion.buscarSesionActiva.mockResolvedValue(sesionAdministrador)
      const respuesta = await publicar(
        app,
        '/administracion/usuarios/abc/desbloqueo',
      )
        .set('Cookie', COOKIE)
        .send()
      expect(respuesta.status).toBe(400)
    })
  })

  describe('mi cuenta', () => {
    const cuerpo = {
      contrasenaActual: CONTRASENA,
      contrasenaNueva: 'una-clave-nueva-9',
    }

    it('sin sesión responde 401', async () => {
      const { app } = prepararApp()
      const respuesta = await publicar(app, '/cuenta/contrasena').send(cuerpo)
      expect(respuesta.status).toBe(401)
    })

    it('cambia la contraseña, cierra las otras sesiones y deja abierta la actual', async () => {
      const { app, sesion, cuenta, bitacora } = prepararApp()
      sesion.buscarSesionActiva.mockResolvedValue(sesionUsuario)
      cuenta.buscarPorId.mockResolvedValue(crearUsuarioFalso({ id: 3 }))

      const respuesta = await publicar(app, '/cuenta/contrasena')
        .set('Cookie', COOKIE)
        .send(cuerpo)

      expect(respuesta.status).toBe(200)
      expect(cuenta.cambiarContrasena).toHaveBeenCalledTimes(1)
      expect(cuenta.cambiarContrasena.mock.calls[0]?.[1]).not.toContain(
        'una-clave-nueva-9',
      )
      expect(sesion.revocarOtrasSesiones).toHaveBeenCalledWith(
        sesionUsuario.usuarioId,
        sesionUsuario.sesionId,
      )
      expect(sesion.revocarSesionesDeUsuario).not.toHaveBeenCalled()
      expect(bitacora.insertarEvento).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: 'contrasena_cambiada' }),
      )
    })

    it('con la actual incorrecta responde 403 con código y no cambia nada', async () => {
      const { app, sesion, cuenta } = prepararApp()
      sesion.buscarSesionActiva.mockResolvedValue(sesionUsuario)
      cuenta.buscarPorId.mockResolvedValue(crearUsuarioFalso({ id: 3 }))

      const respuesta = await publicar(app, '/cuenta/contrasena')
        .set('Cookie', COOKIE)
        .send({ ...cuerpo, contrasenaActual: 'incorrecta-incorrecta' })

      expect(respuesta.status).toBe(403)
      expect(respuesta.body.codigo).toBe('actual_incorrecta')
      expect(cuenta.registrarIntentoFallido).toHaveBeenCalledTimes(1)
      expect(cuenta.cambiarContrasena).not.toHaveBeenCalled()
      expect(sesion.revocarOtrasSesiones).not.toHaveBeenCalled()
    })

    it('con la cuenta bloqueada responde 429', async () => {
      const { app, sesion, cuenta } = prepararApp()
      sesion.buscarSesionActiva.mockResolvedValue(sesionUsuario)
      cuenta.buscarPorId.mockResolvedValue(
        crearUsuarioFalso({ id: 3, bloqueadoHasta: new Date(AHORA + 60_000) }),
      )

      const respuesta = await publicar(app, '/cuenta/contrasena')
        .set('Cookie', COOKIE)
        .send(cuerpo)

      expect(respuesta.status).toBe(429)
      expect(cuenta.cambiarContrasena).not.toHaveBeenCalled()
    })

    it.each([
      [{ contrasenaNueva: 'corta' }],
      [{ contrasenaNueva: CONTRASENA }],
      [{ extra: 'x' }],
    ])('responde 400 con %j y no consulta la base', async (cambio) => {
      const { app, sesion, cuenta } = prepararApp()
      sesion.buscarSesionActiva.mockResolvedValue(sesionUsuario)

      const respuesta = await publicar(app, '/cuenta/contrasena')
        .set('Cookie', COOKIE)
        .send({ ...cuerpo, ...cambio })

      expect(respuesta.status).toBe(400)
      expect(cuenta.buscarPorId).not.toHaveBeenCalled()
    })

    it('rechaza un POST sin Origin propio', async () => {
      const { app, sesion, cuenta } = prepararApp()
      sesion.buscarSesionActiva.mockResolvedValue(sesionUsuario)
      const respuesta = await request(app)
        .post('/api/panel/cuenta/contrasena')
        .set('Cookie', COOKIE)
        .send(cuerpo)
      expect(respuesta.status).toBe(403)
      expect(cuenta.buscarPorId).not.toHaveBeenCalled()
    })
  })

  describe('exportar la bitácora', () => {
    const evento = {
      id: 9,
      ocurrioEn: new Date('2026-11-06T18:00:00Z'),
      tipo: 'entrada_fallida',
      usuarioId: null,
      correo: '=cmd@ejemplo.com',
      ip: '203.0.113.7',
      actorCorreo: null,
    }

    it('sin sesión responde 401 y un usuario normal 403', async () => {
      const { app, sesion, bitacora } = prepararApp()
      expect(
        (await consultar(app, '/administracion/bitacora/exportar')).status,
      ).toBe(401)

      sesion.buscarSesionActiva.mockResolvedValue(sesionUsuario)
      const respuesta = await consultar(
        app,
        '/administracion/bitacora/exportar',
      ).set('Cookie', COOKIE)
      expect(respuesta.status).toBe(403)
      expect(bitacora.listarEventos).not.toHaveBeenCalled()
    })

    it('un administrador descarga un CSV, sin fórmulas peligrosas, y queda anotado', async () => {
      const { app, sesion, bitacora } = prepararApp()
      sesion.buscarSesionActiva.mockResolvedValue(sesionAdministrador)
      bitacora.listarEventos.mockResolvedValue([evento])

      const respuesta = await consultar(
        app,
        '/administracion/bitacora/exportar?grupo=alertas',
      ).set('Cookie', COOKIE)

      expect(respuesta.status).toBe(200)
      expect(respuesta.headers['content-type']).toContain('text/csv')
      expect(respuesta.headers['content-disposition']).toMatch(
        /^attachment; filename="bitacora-\d{4}-\d{2}-\d{2}\.csv"$/,
      )
      expect(respuesta.headers['x-truncado']).toBe('no')
      expect(respuesta.headers['cache-control']).toBe('no-store')
      expect(respuesta.text).toContain(
        "9,2026-11-06T18:00:00.000Z,entrada_fallida,'=cmd@ejemplo.com,203.0.113.7,",
      )
      expect(bitacora.insertarEvento).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'bitacora_exportada',
          usuarioId: sesionAdministrador.usuarioId,
        }),
      )
    })

    it('responde 400 con un filtro inválido', async () => {
      const { app, sesion, bitacora } = prepararApp()
      sesion.buscarSesionActiva.mockResolvedValue(sesionAdministrador)
      const respuesta = await consultar(
        app,
        '/administracion/bitacora/exportar?grupo=otro',
      ).set('Cookie', COOKIE)
      expect(respuesta.status).toBe(400)
      expect(bitacora.listarEventos).not.toHaveBeenCalled()
    })
  })

  describe('sistema', () => {
    it('sin sesión responde 401', async () => {
      const { app } = prepararApp()
      const respuesta = await consultar(app, '/sistema/estado')
      expect(respuesta.status).toBe(401)
    })

    it('sin sesión, el estado del servidor responde 401', async () => {
      const { app, sistema } = prepararApp()
      const respuesta = await consultar(app, '/sistema/servidor')
      expect(respuesta.status).toBe(401)
      expect(sistema.leerDisco).not.toHaveBeenCalled()
    })

    it('un usuario común no ve el estado del servidor (403)', async () => {
      const { app, sesion, sistema } = prepararApp()
      sesion.buscarSesionActiva.mockResolvedValue(sesionUsuario)
      const respuesta = await consultar(app, '/sistema/servidor').set(
        'Cookie',
        COOKIE,
      )
      expect(respuesta.status).toBe(403)
      expect(sistema.leerDisco).not.toHaveBeenCalled()
      expect(sistema.comprobarApiReceptora).not.toHaveBeenCalled()
    })

    it('un administrador recibe el estado del servidor', async () => {
      const { app, sesion } = prepararApp()
      sesion.buscarSesionActiva.mockResolvedValue(sesionAdministrador)
      const respuesta = await consultar(app, '/sistema/servidor').set(
        'Cookie',
        COOKIE,
      )
      expect(respuesta.status).toBe(200)
      expect(respuesta.headers['cache-control']).toBe('no-store')
      expect(respuesta.body.disco).toEqual({
        totalBytes: 8000000000,
        usadoBytes: 3000000000,
      })
      expect(respuesta.body.baseDatos).toEqual({
        totalBytes: 9000000,
        lecturasBytes: 4000000,
      })
      expect(respuesta.body.servicios).toEqual({
        baseDatosPanel: 'ok',
        baseDatosLecturas: 'ok',
        apiReceptora: 'ok',
      })
    })

    it('cualquier usuario con sesión recibe el estado', async () => {
      const { app, sesion, sistema } = prepararApp()
      sesion.buscarSesionActiva.mockResolvedValue(sesionUsuario)
      sistema.obtenerEstadoLecturas.mockResolvedValue([
        {
          plc: 'S7-1500',
          variable: 'contador_piezas',
          ts: new Date('2026-11-06T18:00:00Z'),
          segundosDesdeRecibida: 12,
        },
      ])

      const respuesta = await consultar(app, '/sistema/estado').set(
        'Cookie',
        COOKIE,
      )

      expect(respuesta.status).toBe(200)
      expect(respuesta.headers['cache-control']).toBe('no-store')
      expect(respuesta.body).toEqual({
        api: 'ok',
        baseDatosPanel: 'ok',
        baseDatosLecturas: 'ok',
        datos: 'al_dia',
        variables: [
          {
            plc: 'S7-1500',
            variable: 'contador_piezas',
            ts: '2026-11-06T18:00:00.000Z',
            segundosDesdeRecibida: 12,
          },
        ],
      })
    })

    it('si una base falla responde 200 diciendo cuál', async () => {
      const { app, sesion, sistema } = prepararApp()
      sesion.buscarSesionActiva.mockResolvedValue(sesionUsuario)
      sistema.comprobarBasePanel.mockRejectedValue(new Error('caida'))
      vi.spyOn(console, 'error').mockImplementation(() => {})

      const respuesta = await consultar(app, '/sistema/estado').set(
        'Cookie',
        COOKIE,
      )

      expect(respuesta.status).toBe(200)
      expect(respuesta.body.baseDatosPanel).toBe('falla')
    })

    describe('disponibilidad', () => {
      it('sin sesión responde 401', async () => {
        const { app, sistema } = prepararApp()
        const respuesta = await consultar(
          app,
          '/sistema/disponibilidad?ventana=24h',
        )
        expect(respuesta.status).toBe(401)
        expect(sistema.obtenerActividadLecturas).not.toHaveBeenCalled()
      })

      it('con sesión entrega las cubetas y el resumen', async () => {
        const { app, sesion, sistema } = prepararApp()
        sesion.buscarSesionActiva.mockResolvedValue(sesionUsuario)

        const respuesta = await consultar(
          app,
          '/sistema/disponibilidad?ventana=24h',
        ).set('Cookie', COOKIE)

        expect(respuesta.status).toBe(200)
        expect(respuesta.headers['cache-control']).toBe('no-store')
        expect(sistema.obtenerActividadLecturas).toHaveBeenCalledWith(
          seguridad.sistema.disponibilidad['24h'].cubetaSegundos,
          seguridad.sistema.disponibilidad['24h'].cantidad,
        )
        expect(respuesta.body.ventana).toBe('24h')
        expect(respuesta.body.ok).toBeUndefined()
        expect(respuesta.body.cubetas).toHaveLength(
          seguridad.sistema.disponibilidad['24h'].cantidad,
        )
        expect(respuesta.body.resumen).toMatchObject({
          cubetasConDatos: 1,
        })
        expect(Array.isArray(respuesta.body.cortes)).toBe(true)
      })

      it.each([
        ['', 'sin ventana'],
        ['?ventana=30d', 'ventana que no existe'],
        ['?ventana=24h&otra=1', 'parámetro de más'],
      ])('%s (%s) responde 400', async (consultaTexto) => {
        const { app, sesion, sistema } = prepararApp()
        sesion.buscarSesionActiva.mockResolvedValue(sesionUsuario)

        const respuesta = await consultar(
          app,
          `/sistema/disponibilidad${consultaTexto}`,
        ).set('Cookie', COOKIE)

        expect(respuesta.status).toBe(400)
        expect(sistema.obtenerActividadLecturas).not.toHaveBeenCalled()
      })

      it('si la base falla responde 500 sin detalles', async () => {
        const { app, sesion, sistema } = prepararApp()
        sesion.buscarSesionActiva.mockResolvedValue(sesionUsuario)
        sistema.obtenerActividadLecturas.mockRejectedValue(new Error('secreto'))
        vi.spyOn(console, 'error').mockImplementation(() => {})

        const respuesta = await consultar(
          app,
          '/sistema/disponibilidad?ventana=24h',
        ).set('Cookie', COOKIE)

        expect(respuesta.status).toBe(500)
        expect(JSON.stringify(respuesta.body)).not.toContain('secreto')
      })
    })
  })

  describe('límite por IP', () => {
    it('después del máximo de peticiones responde 429', async () => {
      const { app } = prepararApp()
      for (let i = 0; i < seguridad.limitador.maximoPorIp; i++) {
        const respuesta = await publicar(app, '/autenticacion/entrar').send({})
        expect(respuesta.status).toBe(400)
      }
      const bloqueada = await publicar(app, '/autenticacion/entrar').send({})
      expect(bloqueada.status).toBe(429)
      expect(bloqueada.body).toEqual({
        error: 'Demasiadas peticiones. Intenta más tarde.',
      })
    })

    it('no cuenta las rutas con sesión ni /salud', async () => {
      const { app } = prepararApp()
      for (let i = 0; i < seguridad.limitador.maximoPorIp + 5; i++) {
        await consultar(app, '/salud')
      }
      const respuesta = await publicar(app, '/autenticacion/entrar').send({})
      expect(respuesta.status).toBe(400)
    })
  })

  describe('errores internos y rutas desconocidas', () => {
    it('responde 500 sin detalles internos cuando falla la base de datos', async () => {
      const registro = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { app, autenticacion } = prepararApp()
      autenticacion.buscarPorCorreo.mockRejectedValue(
        new Error('secreto interno: password=123'),
      )

      const respuesta = await publicar(app, '/autenticacion/entrar').send({
        correo: 'ana@ejemplo.com',
        contrasena: CONTRASENA,
      })

      expect(respuesta.status).toBe(500)
      expect(respuesta.body).toEqual({ error: 'Error interno' })
      expect(JSON.stringify(respuesta.body)).not.toContain('secreto')
      expect(registro).toHaveBeenCalled()
    })

    it('responde 413 si el cuerpo pasa del límite', async () => {
      const { app } = prepararApp()
      const respuesta = await publicar(app, '/autenticacion/entrar').send({
        relleno: 'x'.repeat(20_000),
      })
      expect(respuesta.status).toBe(413)
    })

    it('responde 400 si el JSON está mal formado', async () => {
      const { app } = prepararApp()
      const respuesta = await publicar(app, '/autenticacion/entrar')
        .set('Content-Type', 'application/json')
        .send('{"correo": ')
      expect(respuesta.status).toBe(400)
    })

    it('responde 404 en una ruta que no existe', async () => {
      const { app } = prepararApp()
      const respuesta = await consultar(app, '/otra')
      expect(respuesta.status).toBe(404)
    })
  })
})
