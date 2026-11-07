import { seguridad } from '../configuracion/seguridad'
import {
  validarConsultaBitacora,
  validarConsultaExportar,
} from '../esquemas/bitacora.esquema'
import {
  TIPOS_ALERTA,
  type EventoBitacora,
  type EventoNuevo,
  type FiltrosBitacora,
} from '../repositorios/bitacora.repositorio'
import { aCsv } from '../utilidades/csv'

export type ResultadoListar =
  | { ok: true; eventos: EventoBitacora[]; hayMas: boolean }
  | { ok: false; error: string }

export type ResultadoExportar =
  { ok: true; csv: string; truncado: boolean } | { ok: false; error: string }

type Dependencias = {
  insertarEvento: (evento: EventoNuevo) => Promise<void>
  listarEventos: (filtros: FiltrosBitacora) => Promise<EventoBitacora[]>
}

export function crearServicioBitacora({
  insertarEvento,
  listarEventos,
}: Dependencias) {
  // Nunca lanza: si la bitacora falla, el login y lo demas siguen funcionando.
  async function registrar(evento: EventoNuevo): Promise<void> {
    try {
      await insertarEvento(evento)
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'desconocido'
      console.error('No se pudo escribir en la bitacora:', mensaje)
    }
  }

  return {
    registrar,

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

    // Del más nuevo al más viejo, hasta el tope. La descarga también queda anotada en la bitácora.
    async exportar(
      consulta: unknown,
      usuarioId: number,
      correo: string,
      ip: string | null,
    ): Promise<ResultadoExportar> {
      const validacion = validarConsultaExportar(consulta)
      if (!validacion.ok) return validacion

      const maximo = seguridad.bitacora.maximoExportacion
      const filas = await listarEventos({
        tipos: validacion.datos === 'alertas' ? TIPOS_ALERTA : null,
        antes: null,
        limite: maximo + 1,
      })
      const eventos = filas.slice(0, maximo)
      const csv = aCsv(
        ['id', 'fecha_utc', 'tipo', 'correo', 'ip', 'actor'],
        eventos.map((e) => [
          e.id,
          e.ocurrioEn.toISOString(),
          e.tipo,
          e.correo,
          e.ip,
          e.actorCorreo,
        ]),
      )
      await registrar({ tipo: 'bitacora_exportada', usuarioId, correo, ip })
      return { ok: true, csv, truncado: filas.length > maximo }
    },
  }
}

export type ServicioBitacora = ReturnType<typeof crearServicioBitacora>
