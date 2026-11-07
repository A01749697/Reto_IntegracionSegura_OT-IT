import { validarConsultaBitacora } from '../esquemas/bitacora.esquema'
import {
  TIPOS_ALERTA,
  type EventoBitacora,
  type EventoNuevo,
  type FiltrosBitacora,
} from '../repositorios/bitacora.repositorio'

export type ResultadoListar =
  | { ok: true; eventos: EventoBitacora[]; hayMas: boolean }
  | { ok: false; error: string }

type Dependencias = {
  insertarEvento: (evento: EventoNuevo) => Promise<void>
  listarEventos: (filtros: FiltrosBitacora) => Promise<EventoBitacora[]>
}

export function crearServicioBitacora({
  insertarEvento,
  listarEventos,
}: Dependencias) {
  return {
    // Nunca lanza: si la bitacora falla, el login y lo demas siguen funcionando.
    async registrar(evento: EventoNuevo): Promise<void> {
      try {
        await insertarEvento(evento)
      } catch (error) {
        const mensaje = error instanceof Error ? error.message : 'desconocido'
        console.error('No se pudo escribir en la bitacora:', mensaje)
      }
    },

    async listar(consulta: unknown): Promise<ResultadoListar> {
      const validacion = validarConsultaBitacora(consulta)
      if (!validacion.ok) return validacion
      const { grupo, antes, limite } = validacion.datos

      // se pide uno de mas solo para saber si quedan eventos
      const filas = await listarEventos({
        tipos: grupo === 'alertas' ? TIPOS_ALERTA : null,
        antes,
        limite: limite + 1,
      })
      return {
        ok: true,
        eventos: filas.slice(0, limite),
        hayMas: filas.length > limite,
      }
    },
  }
}

export type ServicioBitacora = ReturnType<typeof crearServicioBitacora>
