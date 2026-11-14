import { seguridad } from '../configuracion/seguridad'
import { validarConsultaDisponibilidad } from '../esquemas/sistema.esquema'
import type {
  ActividadLecturas,
  EstadoVariable,
} from '../repositorios/lecturas.repositorio'
import {
  calcularDisponibilidad,
  type Disponibilidad,
} from '../utilidades/disponibilidad'

type Parte = 'ok' | 'falla'
export type Datos = 'al_dia' | 'retrasado' | 'sin_datos' | 'desconocido'

export type EstadoSistema = {
  api: 'ok'
  baseDatosPanel: Parte
  baseDatosLecturas: Parte
  datos: Datos
  variables: EstadoVariable[]
}

export type ResultadoDisponibilidad =
  { ok: true; disponibilidad: Disponibilidad } | { ok: false; error: string }

type Dependencias = {
  comprobarBasePanel: () => Promise<void>
  obtenerEstadoLecturas: () => Promise<EstadoVariable[]>
  obtenerActividadLecturas: (
    cubetaSegundos: number,
    cantidad: number,
  ) => Promise<ActividadLecturas>
}

function avisarFalla(nombre: string, razon: unknown) {
  const mensaje = razon instanceof Error ? razon.message : 'desconocido'
  console.error(`Falla al comprobar ${nombre}:`, mensaje)
}

export function crearServicioSistema({
  comprobarBasePanel,
  obtenerEstadoLecturas,
  obtenerActividadLecturas,
}: Dependencias) {
  return {
    async estado(): Promise<EstadoSistema> {
      const [panel, lecturas] = await Promise.allSettled([
        comprobarBasePanel(),
        obtenerEstadoLecturas(),
      ])
      if (panel.status === 'rejected')
        avisarFalla('la base del panel', panel.reason)
      if (lecturas.status === 'rejected') {
        avisarFalla('la base de lecturas', lecturas.reason)
      }

      const variables = lecturas.status === 'fulfilled' ? lecturas.value : []
      let datos: Datos = 'desconocido'
      if (lecturas.status === 'fulfilled') {
        if (variables.length === 0) datos = 'sin_datos'
        else {
          const masReciente = Math.min(
            ...variables.map((v) => v.segundosDesdeRecibida),
          )
          datos =
            masReciente <= seguridad.sistema.lecturaRetrasadaSegundos
              ? 'al_dia'
              : 'retrasado'
        }
      }

      return {
        api: 'ok',
        baseDatosPanel: panel.status === 'fulfilled' ? 'ok' : 'falla',
        baseDatosLecturas: lecturas.status === 'fulfilled' ? 'ok' : 'falla',
        datos,
        variables,
      }
    },

    // Primero se validan los filtros y, solo si son válidos, se consulta la base.
    // Si la base falla, el error sube y la API responde 500 (no se inventa un historial).
    async disponibilidad(consulta: unknown): Promise<ResultadoDisponibilidad> {
      const validacion = validarConsultaDisponibilidad(consulta)
      if (!validacion.ok) return validacion

      const { cubetaSegundos, cantidad } =
        seguridad.sistema.disponibilidad[validacion.ventana]
      const actividad = await obtenerActividadLecturas(cubetaSegundos, cantidad)
      return {
        ok: true,
        disponibilidad: calcularDisponibilidad({
          ventana: validacion.ventana,
          cubetaSegundos,
          cantidad,
          maximoCortes: seguridad.sistema.maximoCortes,
          actividad,
        }),
      }
    },
  }
}

export type ServicioSistema = ReturnType<typeof crearServicioSistema>
