// Lógica de las lecturas para el dashboard: último valor de cada variable e historial de una variable.
// En el historial, primero se validan los filtros y, solo si son válidos, se consulta la base.
import { seguridad } from '../configuracion/seguridad'
import { validarConsultaHistorial } from '../esquemas/lecturas.esquema'
import type {
  FiltrosHistorial,
  Historial,
  UltimaLectura,
} from '../repositorios/lecturas.repositorio'

export type ResultadoHistorial =
  ({ ok: true } & Historial) | { ok: false; error: string }

type Dependencias = {
  obtenerUltimasLecturas: () => Promise<UltimaLectura[]>
  obtenerHistorial: (filtros: FiltrosHistorial) => Promise<Historial>
}

export function crearServicioLecturas({
  obtenerUltimasLecturas,
  obtenerHistorial,
}: Dependencias) {
  return {
    async ultimas(): Promise<UltimaLectura[]> {
      return obtenerUltimasLecturas()
    },

    async historial(consulta: unknown): Promise<ResultadoHistorial> {
      const validacion = validarConsultaHistorial(consulta)
      if (!validacion.ok) return validacion

      const historial = await obtenerHistorial({
        ...validacion.consulta,
        limite: seguridad.lecturas.maximoPuntosHistorial,
      })
      return { ok: true, ...historial }
    },
  }
}

export type ServicioLecturas = ReturnType<typeof crearServicioLecturas>
