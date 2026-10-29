// Lógica de las sesiones: crear el código, validarlo y cerrarlo.
// El código completo solo viaja en la cookie; en la base solo se guarda su huella.
import { seguridad } from '../configuracion/seguridad'
import type { SesionActiva } from '../repositorios/sesiones.repositorio'
import {
  calcularHuellaToken,
  generarToken,
  tieneFormatoDeToken,
} from '../utilidades/tokens'

type Dependencias = {
  crearSesion: (
    usuarioId: number,
    tokenHash: string,
    duracionMaximaMs: number,
  ) => Promise<void>
  buscarSesionActiva: (
    tokenHash: string,
    inactividadMaximaMs: number,
  ) => Promise<SesionActiva | null>
  revocarSesion: (tokenHash: string) => Promise<void>
  revocarSesionesDeUsuario: (usuarioId: number) => Promise<void>
}

export function crearServicioSesion({
  crearSesion,
  buscarSesionActiva,
  revocarSesion,
  revocarSesionesDeUsuario,
}: Dependencias) {
  return {
    // Devuelve el código que se pondrá en la cookie.
    async iniciar(usuarioId: number): Promise<string> {
      const token = generarToken()
      await crearSesion(
        usuarioId,
        calcularHuellaToken(token),
        seguridad.sesion.duracionMaximaMs,
      )
      return token
    },

    // Devuelve la sesión si sirve, o null por cualquier motivo (sin cookie, mal formada,
    // caducada, revocada o de una cuenta que ya no está aprobada).
    async validar(token: string | undefined): Promise<SesionActiva | null> {
      if (token === undefined || !tieneFormatoDeToken(token)) return null
      return buscarSesionActiva(
        calcularHuellaToken(token),
        seguridad.sesion.inactividadMaximaMs,
      )
    },

    async cerrar(token: string | undefined): Promise<void> {
      if (token === undefined || !tieneFormatoDeToken(token)) return
      await revocarSesion(calcularHuellaToken(token))
    },

    async cerrarTodasDe(usuarioId: number): Promise<void> {
      await revocarSesionesDeUsuario(usuarioId)
    },
  }
}

export type ServicioSesion = ReturnType<typeof crearServicioSesion>
