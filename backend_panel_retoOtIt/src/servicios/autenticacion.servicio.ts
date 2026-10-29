// Lógica de crear cuentas y de entrar: contraseñas, bloqueo por intentos y estado de la cuenta.
import { seguridad } from '../configuracion/seguridad'
import type {
  DatosCrearCuenta,
  DatosEntrar,
} from '../esquemas/autenticacion.esquema'
import type {
  ResultadoCrear,
  Rol,
  Usuario,
} from '../repositorios/usuarios.repositorio'
import {
  crearHuella,
  gastarTiempoDeVerificacion,
  verificarContrasena,
} from '../utilidades/contrasenas'

export type UsuarioPublico = {
  id: number
  nombre: string
  correo: string
  rol: Rol
}

export type ResultadoEntrar =
  | { ok: true; token: string; usuario: UsuarioPublico }
  | {
      ok: false
      motivo: 'credenciales_invalidas' | 'bloqueada' | 'pendiente' | 'rechazada'
    }

type Dependencias = {
  crearUsuario: (datos: {
    nombre: string
    correo: string
    contrasenaHash: string
  }) => Promise<ResultadoCrear>
  buscarPorCorreo: (correo: string) => Promise<Usuario | null>
  registrarIntentoFallido: (
    usuarioId: number,
    intentosMaximos: number,
    bloqueoMs: number,
  ) => Promise<void>
  limpiarIntentos: (usuarioId: number) => Promise<void>
  iniciarSesion: (usuarioId: number) => Promise<string>
  ahora: () => number
}

export function crearServicioAutenticacion({
  crearUsuario,
  buscarPorCorreo,
  registrarIntentoFallido,
  limpiarIntentos,
  iniciarSesion,
  ahora,
}: Dependencias) {
  return {
    // Responde lo mismo exista o no el correo, para no revelar qué correos están registrados.
    // Se calcula la huella siempre, así la demora también es la misma.
    async crearCuenta(datos: DatosCrearCuenta): Promise<void> {
      const contrasenaHash = await crearHuella(datos.contrasena)
      await crearUsuario({
        nombre: datos.nombre,
        correo: datos.correo,
        contrasenaHash,
      })
    },

    async entrar(datos: DatosEntrar): Promise<ResultadoEntrar> {
      const usuario = await buscarPorCorreo(datos.correo)

      // Correo que no existe: se gasta el mismo tiempo que una verificación real.
      if (usuario === null) {
        await gastarTiempoDeVerificacion(datos.contrasena)
        return { ok: false, motivo: 'credenciales_invalidas' }
      }

      if (
        usuario.bloqueadoHasta !== null &&
        usuario.bloqueadoHasta.getTime() > ahora()
      ) {
        return { ok: false, motivo: 'bloqueada' }
      }

      const coincide = await verificarContrasena(
        datos.contrasena,
        usuario.contrasenaHash,
      )
      if (!coincide) {
        await registrarIntentoFallido(
          usuario.id,
          seguridad.bloqueo.intentosMaximos,
          seguridad.bloqueo.duracionMs,
        )
        return { ok: false, motivo: 'credenciales_invalidas' }
      }

      if (usuario.intentosFallidos > 0 || usuario.bloqueadoHasta !== null) {
        await limpiarIntentos(usuario.id)
      }

      // Solo quien ya demostró conocer la contraseña se entera del estado de su cuenta.
      if (usuario.estado === 'pendiente') {
        return { ok: false, motivo: 'pendiente' }
      }
      if (usuario.estado === 'rechazado') {
        return { ok: false, motivo: 'rechazada' }
      }

      const token = await iniciarSesion(usuario.id)
      return {
        ok: true,
        token,
        usuario: {
          id: usuario.id,
          nombre: usuario.nombre,
          correo: usuario.correo,
          rol: usuario.rol,
        },
      }
    },
  }
}

export type ServicioAutenticacion = ReturnType<
  typeof crearServicioAutenticacion
>
