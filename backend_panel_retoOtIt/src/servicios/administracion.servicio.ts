// Reglas para que un administrador revise y decida sobre las cuentas.
import type {
  Estado,
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

type Dependencias = {
  listarPorEstado: (estado: Estado) => Promise<UsuarioResumen[]>
  buscarPorId: (id: number) => Promise<Usuario | null>
  cambiarEstado: (
    id: number,
    estado: Decision,
    decididoPor: number,
  ) => Promise<boolean>
  cerrarSesionesDe: (usuarioId: number) => Promise<void>
}

export function crearServicioAdministracion({
  listarPorEstado,
  buscarPorId,
  cambiarEstado,
  cerrarSesionesDe,
}: Dependencias) {
  return {
    async listar(estado: Estado): Promise<UsuarioResumen[]> {
      return listarPorEstado(estado)
    },

    // administradorId es quien decide; el intermediario ya comprobó que lo es.
    async decidir(
      usuarioId: number,
      decision: Decision,
      administradorId: number,
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

      return { ok: true }
    },
  }
}

export type ServicioAdministracion = ReturnType<
  typeof crearServicioAdministracion
>
