// Reglas para que un administrador revise y decida sobre las cuentas.
import type { EventoNuevo } from '../repositorios/bitacora.repositorio'
import type {
  FiltroEstado,
  Rol,
  Usuario,
  UsuarioResumen,
} from '../repositorios/usuarios.repositorio'

export type Decision = 'aprobado' | 'rechazado'

export type ResultadoDecision =
  | { ok: true }
  | {
      ok: false
      motivo: 'no_existe' | 'es_propia' | 'es_administrador' | 'sin_cambio'
    }

export type ResultadoDesbloqueo =
  { ok: true } | { ok: false; motivo: 'no_existe' | 'sin_cambio' }

export type ResultadoPromocion =
  | { ok: true }
  | { ok: false; motivo: 'no_existe' | 'sin_cambio' | 'no_aprobada' }

type Dependencias = {
  listarPorEstado: (estado: FiltroEstado) => Promise<UsuarioResumen[]>
  buscarPorId: (id: number) => Promise<Usuario | null>
  cambiarEstado: (
    id: number,
    estado: Decision,
    decididoPor: number,
  ) => Promise<boolean>
  cambiarRol: (id: number, rol: Rol) => Promise<boolean>
  limpiarIntentos: (usuarioId: number) => Promise<void>
  cerrarSesionesDe: (usuarioId: number) => Promise<void>
  registrarEvento: (evento: EventoNuevo) => Promise<void>
  ahora: () => number
}

export function crearServicioAdministracion({
  listarPorEstado,
  buscarPorId,
  cambiarEstado,
  cambiarRol,
  limpiarIntentos,
  cerrarSesionesDe,
  registrarEvento,
  ahora,
}: Dependencias) {
  return {
    async listar(estado: FiltroEstado): Promise<UsuarioResumen[]> {
      return listarPorEstado(estado)
    },

    // administradorId es quien decide; el intermediario ya comprobó que lo es.
    async decidir(
      usuarioId: number,
      decision: Decision,
      administradorId: number,
      ip: string | null,
    ): Promise<ResultadoDecision> {
      // Nadie decide sobre su propia cuenta.
      if (usuarioId === administradorId) {
        return { ok: false, motivo: 'es_propia' }
      }

      const usuario = await buscarPorId(usuarioId)
      if (usuario === null) return { ok: false, motivo: 'no_existe' }

      // Las cuentas de administrador no se tocan desde el panel (solo desde la base de datos),
      // así un administrador no puede dejar fuera a los demás.
      if (usuario.rol === 'administrador') {
        return { ok: false, motivo: 'es_administrador' }
      }

      if (usuario.estado === decision)
        return { ok: false, motivo: 'sin_cambio' }

      const cambiado = await cambiarEstado(usuarioId, decision, administradorId)
      if (!cambiado) return { ok: false, motivo: 'no_existe' }

      // Quien pierde el acceso pierde también sus sesiones abiertas.
      if (decision === 'rechazado') await cerrarSesionesDe(usuarioId)

      await registrarEvento({
        tipo: decision === 'aprobado' ? 'cuenta_aprobada' : 'cuenta_rechazada',
        usuarioId,
        actorId: administradorId,
        correo: usuario.correo,
        ip,
      })

      return { ok: true }
    },

    // Quita el bloqueo por intentos fallidos. Sirve para cualquier cuenta, también otro administrador.
    async desbloquear(
      usuarioId: number,
      administradorId: number,
      ip: string | null,
    ): Promise<ResultadoDesbloqueo> {
      const usuario = await buscarPorId(usuarioId)
      if (usuario === null) return { ok: false, motivo: 'no_existe' }
      if (
        usuario.bloqueadoHasta === null ||
        usuario.bloqueadoHasta.getTime() <= ahora()
      ) {
        return { ok: false, motivo: 'sin_cambio' }
      }

      await limpiarIntentos(usuarioId)
      await registrarEvento({
        tipo: 'cuenta_desbloqueada',
        usuarioId,
        actorId: administradorId,
        correo: usuario.correo,
        ip,
      })
      return { ok: true }
    },

    // Solo en un sentido: de usuario a administrador. Bajar a un administrador se hace desde la base de datos.
    async hacerAdministrador(
      usuarioId: number,
      administradorId: number,
      ip: string | null,
    ): Promise<ResultadoPromocion> {
      const usuario = await buscarPorId(usuarioId)
      if (usuario === null) return { ok: false, motivo: 'no_existe' }
      if (usuario.rol === 'administrador') {
        return { ok: false, motivo: 'sin_cambio' }
      }
      if (usuario.estado !== 'aprobado') {
        return { ok: false, motivo: 'no_aprobada' }
      }

      const cambiado = await cambiarRol(usuarioId, 'administrador')
      if (!cambiado) return { ok: false, motivo: 'no_existe' }
      await registrarEvento({
        tipo: 'rol_cambiado',
        usuarioId,
        actorId: administradorId,
        correo: usuario.correo,
        ip,
      })
      return { ok: true }
    },
  }
}

export type ServicioAdministracion = ReturnType<
  typeof crearServicioAdministracion
>
