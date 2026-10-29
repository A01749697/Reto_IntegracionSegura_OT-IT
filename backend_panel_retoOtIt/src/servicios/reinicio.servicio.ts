// Lógica de "olvidé mi contraseña": pedir el enlace y usarlo para escribir una contraseña nueva.
import { seguridad } from '../configuracion/seguridad'
import type { DatosUsarEnlace } from '../esquemas/autenticacion.esquema'
import type { Usuario } from '../repositorios/usuarios.repositorio'
import { crearHuella } from '../utilidades/contrasenas'
import { calcularHuellaToken, generarToken } from '../utilidades/tokens'

type Dependencias = {
  buscarPorCorreo: (correo: string) => Promise<Usuario | null>
  invalidarEnlacesPendientes: (usuarioId: number) => Promise<void>
  crearEnlace: (
    usuarioId: number,
    tokenHash: string,
    duracionMs: number,
  ) => Promise<void>
  enviarEnlaceReinicio: (destinatario: string, token: string) => Promise<void>
  consumirEnlace: (tokenHash: string) => Promise<number | null>
  cambiarContrasena: (
    usuarioId: number,
    contrasenaHash: string,
  ) => Promise<void>
  cerrarSesionesDe: (usuarioId: number) => Promise<void>
}

export function crearServicioReinicio({
  buscarPorCorreo,
  invalidarEnlacesPendientes,
  crearEnlace,
  enviarEnlaceReinicio,
  consumirEnlace,
  cambiarContrasena,
  cerrarSesionesDe,
}: Dependencias) {
  // Crea el enlace y manda el correo. Corre en segundo plano.
  async function enviarEnlace(usuario: Usuario): Promise<void> {
    const token = generarToken()
    await invalidarEnlacesPendientes(usuario.id)
    await crearEnlace(
      usuario.id,
      calcularHuellaToken(token),
      seguridad.reinicio.duracionEnlaceMs,
    )
    await enviarEnlaceReinicio(usuario.correo, token)
  }

  return {
    // Termina igual exista o no la cuenta, y sin esperar al correo,
    // para que ni la respuesta ni su demora revelen qué correos están registrados.
    async pedir(correo: string): Promise<void> {
      const usuario = await buscarPorCorreo(correo)
      if (usuario === null || usuario.estado === 'rechazado') return

      enviarEnlace(usuario).catch((error: unknown) => {
        // Solo el mensaje: nunca se escribe el código del enlace en el registro.
        const mensaje =
          error instanceof Error ? error.message : 'error desconocido'
        console.error('No se pudo enviar el enlace de reinicio:', mensaje)
      })
    },

    // Devuelve false si el enlace no existe, ya se usó o caducó (no distingue cuál).
    async restablecer(datos: DatosUsarEnlace): Promise<boolean> {
      const usuarioId = await consumirEnlace(calcularHuellaToken(datos.token))
      if (usuarioId === null) return false

      await cambiarContrasena(usuarioId, await crearHuella(datos.contrasena))
      // Si alguien tenía una sesión robada, el cambio de contraseña la deja inservible.
      await cerrarSesionesDe(usuarioId)
      return true
    },
  }
}

export type ServicioReinicio = ReturnType<typeof crearServicioReinicio>
