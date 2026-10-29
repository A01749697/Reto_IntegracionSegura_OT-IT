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
  }
  const lecturas = {
    obtenerUltimasLecturas: vi.fn().mockResolvedValue([]),
    obtenerHistorial: vi
      .fn()
      .mockResolvedValue({ puntos: [], truncado: false }),
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
    lecturas,
    correo,
    ahora: () => AHORA,
  })
  return {
    app,
    sesion,
    autenticacion,
    reinicio,
    administracion,
    lecturas,
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
