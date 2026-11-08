import type {
  Columna,
  FilaDatos,
  FiltrosDatos,
  TablaDatos,
} from '../repositorios/datos.repositorio'
import { CATALOGO, TABLAS_DATOS } from '../repositorios/datos.repositorio'
import type {
  EventoNuevo,
  TipoEvento,
} from '../repositorios/bitacora.repositorio'
import type { ConsultaDatos } from '../esquemas/datos.esquema'

// Cada tabla que se mira deja su propio rastro en la bitácora.
const EVENTO_POR_TABLA: Record<TablaDatos, TipoEvento> = {
  cuentas: 'datos_cuentas_consultadas',
  bitacora: 'datos_bitacora_consultada',
}

export type QuienConsulta = {
  usuarioId: number
  correo: string
  ip: string | null
}

export type PaginaDatos = {
  columnas: readonly Columna[]
  filas: FilaDatos[]
  hayMas: boolean
}

type Dependencias = {
  leerTabla: (tabla: TablaDatos, filtros: FiltrosDatos) => Promise<FilaDatos[]>
  registrarEvento: (evento: EventoNuevo) => Promise<void>
}

export function crearServicioDatos({
  leerTabla,
  registrarEvento,
}: Dependencias) {
  return {
    // Qué tablas hay y con qué columnas, para armar el selector de la pantalla.
    catalogo() {
      return TABLAS_DATOS.map((id) => ({
        id,
        nombre: CATALOGO[id].nombre,
        columnas: CATALOGO[id].columnas,
      }))
    },

    async consultar(
      tabla: TablaDatos,
      consulta: ConsultaDatos,
      quien: QuienConsulta,
    ): Promise<PaginaDatos> {
      // se pide una fila de más solo para saber si quedan
      const filas = await leerTabla(tabla, {
        ...consulta,
        limite: consulta.limite + 1,
      })

      // Solo la primera página queda anotada; "ver más" no repite el aviso.
      if (consulta.antes === null) {
        await registrarEvento({
          tipo: EVENTO_POR_TABLA[tabla],
          usuarioId: quien.usuarioId,
          correo: quien.correo,
          ip: quien.ip,
        })
      }

      return {
        columnas: CATALOGO[tabla].columnas,
        filas: filas.slice(0, consulta.limite),
        hayMas: filas.length > consulta.limite,
      }
    },
  }
}

export type ServicioDatos = ReturnType<typeof crearServicioDatos>
