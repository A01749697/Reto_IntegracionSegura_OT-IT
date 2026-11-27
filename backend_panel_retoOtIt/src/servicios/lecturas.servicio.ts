// Lógica de las lecturas para el dashboard: último valor de cada variable e historial de una variable.
// En el historial, primero se validan los filtros y, solo si son válidos, se consulta la base.
import { seguridad } from '../configuracion/seguridad'
import {
  validarConsultaCambios,
  validarConsultaHistorial,
  validarConsultaIndicadores,
} from '../esquemas/lecturas.esquema'
import type { PlcHistorian } from '../configuracion/historian'
import type {
  Cambio,
  FiltrosHistorial,
  Historial,
  Serie,
  UltimaLectura,
} from '../repositorios/lecturas.repositorio'
import {
  calcularIndicadores,
  eventosDeFalla,
  type CubetaIndicadores,
  type EventoFalla,
  type Series,
} from '../utilidades/indicadores'

export type ResultadoHistorial =
  ({ ok: true } & Historial) | { ok: false; error: string }

export type ResultadoIndicadores =
  | {
      ok: true
      cubetas: CubetaIndicadores[]
      fallas: EventoFalla[]
      truncado: boolean
    }
  | { ok: false; error: string }

export type ResultadoCambios =
  | { ok: true; cambios: Cambio[]; truncado: boolean }
  | { ok: false; error: string }

type Dependencias = {
  obtenerUltimasLecturas: () => Promise<UltimaLectura[]>
  obtenerHistorial: (filtros: FiltrosHistorial) => Promise<Historial>
  obtenerSerie: (
    plc: PlcHistorian,
    nodo: string,
    desde: Date,
    hasta: Date,
    limite: number,
  ) => Promise<Serie>
  obtenerCambios: (
    plc: PlcHistorian,
    nodos: string[],
    desde: Date,
    limite: number,
  ) => Promise<{ cambios: Cambio[]; truncado: boolean }>
  ahora?: () => number
}

// Los nodos del S7-1516 de los que salen los indicadores (los mismos que usa el gemelo).
const NODOS_INDICADORES: Record<keyof Series, string> = {
  aluminio: 'TAB_ALUMINIO',
  otras: 'TAB_OTRAS',
  pasos: 'TAB_PASO',
  torreta: 'TAB_TORRETA',
  latido: 'LATIDO',
  falla: 'TAB_FALLA',
  codFalla: 'TAB_COD_FALLA',
}

export function crearServicioLecturas({
  obtenerUltimasLecturas,
  obtenerHistorial,
  obtenerSerie,
  obtenerCambios,
  ahora = Date.now,
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

    // Producción, uso del tiempo y ciclos por tramo, calculados con todos los cambios.
    async indicadores(consulta: unknown): Promise<ResultadoIndicadores> {
      const validacion = validarConsultaIndicadores(consulta, {
        maximoDias: seguridad.lecturas.maximoDiasIndicadores,
        maximoCubetas: seguridad.lecturas.maximoCubetasIndicadores,
      })
      if (!validacion.ok) return validacion
      const { desde, hasta, cubetaSegundos } = validacion.consulta
      const claves = Object.keys(NODOS_INDICADORES) as (keyof Series)[]
      const leidas = await Promise.all(
        claves.map((clave) =>
          obtenerSerie(
            'S7-1500',
            NODOS_INDICADORES[clave],
            desde,
            hasta,
            seguridad.lecturas.maximoPuntosIndicadores,
          ),
        ),
      )
      const series = Object.fromEntries(
        claves.map((clave, i) => [clave, leidas[i]?.puntos ?? []]),
      ) as Series
      const cubetas = calcularIndicadores(series, {
        desde,
        hasta,
        cubetaSegundos,
        ahora: new Date(ahora()),
      })
      return {
        ok: true,
        cubetas,
        fallas: eventosDeFalla(series, { desde, hasta }),
        truncado: leidas.some((l) => l.truncado),
      }
    },

    // Lo que cambió en varios nodos desde una fecha, en orden, para que el gemelo lo repita.
    async cambios(consulta: unknown): Promise<ResultadoCambios> {
      const validacion = validarConsultaCambios(
        consulta,
        seguridad.lecturas.maximoNodosCambios,
      )
      if (!validacion.ok) return validacion
      const { plc, nodos, desde } = validacion.consulta
      const resultado = await obtenerCambios(
        plc,
        nodos,
        desde,
        seguridad.lecturas.maximoCambios,
      )
      return { ok: true, ...resultado }
    },
  }
}

export type ServicioLecturas = ReturnType<typeof crearServicioLecturas>
