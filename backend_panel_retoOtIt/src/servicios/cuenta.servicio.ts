// Lógica de "Mi cuenta": cambiar la contraseña con la sesión iniciada.
import { seguridad } from '../configuracion/seguridad'
import type { DatosCambiarContrasena } from '../esquemas/autenticacion.esquema'
import type { EventoNuevo } from '../repositorios/bitacora.repositorio'
import type { Usuario } from '../repositorios/usuarios.repositorio'
import { crearHuella, verificarContrasena } from '../utilidades/contrasenas'

export type ResultadoCambio =
  | { ok: true }
  | { ok: false; motivo: 'no_existe' | 'bloqueada' | 'actual_incorrecta' }

type Dependencias = {
  buscarPorId: (id: number) => Promise<Usuario | null>
  registrarIntentoFallido: (
    usuarioId: number,
    intentosMaximos: number,
    bloqueoMs: number,
  ) => Promise<void>
  cambiarContrasena: (
    usuarioId: number,
    contrasenaHash: string,
  ) => Promise<void>
  cerrarOtrasSesiones: (usuarioId: number, sesionId: number) => Promise<void>
  registrarEvento: (evento: EventoNuevo) => Promise<void>
  ahora: () => number
}

export function crearServicioCuenta({
  buscarPorId,
  registrarIntentoFallido,
  cambiarContrasena,
  cerrarOtrasSesiones,
  registrarEvento,
  ahora,
}: Dependencias) {
  return {
    async cambiarContrasena(
      usuarioId: number,
      sesionId: number,
      datos: DatosCambiarContrasena,
      ip: string | null,
    ): Promise<ResultadoCambio> {
      const usuario = await buscarPorId(usuarioId)
      if (usuario === null) return { ok: false, motivo: 'no_existe' }

      const evento = { usuarioId, correo: usuario.correo, ip }

      // Con la cuenta bloqueada tampoco se deja probar contraseñas desde una sesión abierta.
      if (
        usuario.bloqueadoHasta !== null &&
        usuario.bloqueadoHasta.getTime() > ahora()
      ) {
        await registrarEvento({ tipo: 'cambio_contrasena_fallido', ...evento })
        return { ok: false, motivo: 'bloqueada' }
      }

      const coincide = await verificarContrasena(
        datos.actual,
        usuario.contrasenaHash,
      )
      if (!coincide) {
        await registrarIntentoFallido(
          usuarioId,
          seguridad.bloqueo.intentosMaximos,
          seguridad.bloqueo.duracionMs,
        )
        await registrarEvento({ tipo: 'cambio_contrasena_fallido', ...evento })
        if (usuario.intentosFallidos + 1 >= seguridad.bloqueo.intentosMaximos) {
          await registrarEvento({ tipo: 'cuenta_bloqueada', ...evento })
        }
        return { ok: false, motivo: 'actual_incorrecta' }
      }

      await cambiarContrasena(usuarioId, await crearHuella(datos.nueva))
      // Se cierran las demás sesiones; la de ahora sigue abierta.
      await cerrarOtrasSesiones(usuarioId, sesionId)
      await registrarEvento({ tipo: 'contrasena_cambiada', ...evento })
      return { ok: true }
    },
  }
}

export type ServicioCuenta = ReturnType<typeof crearServicioCuenta>
