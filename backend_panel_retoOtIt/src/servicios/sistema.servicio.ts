import { seguridad } from '../configuracion/seguridad'
import type { EstadoVariable } from '../repositorios/lecturas.repositorio'

type Parte = 'ok' | 'falla'
export type Datos = 'al_dia' | 'retrasado' | 'sin_datos' | 'desconocido'

export type EstadoSistema = {
  api: 'ok'
  baseDatosPanel: Parte
  baseDatosLecturas: Parte
  datos: Datos
  variables: EstadoVariable[]
}

type Dependencias = {
  comprobarBasePanel: () => Promise<void>
  obtenerEstadoLecturas: () => Promise<EstadoVariable[]>
}

function avisarFalla(nombre: string, razon: unknown) {
  const mensaje = razon instanceof Error ? razon.message : 'desconocido'
  console.error(`Falla al comprobar ${nombre}:`, mensaje)
}

export function crearServicioSistema({
  comprobarBasePanel,
  obtenerEstadoLecturas,
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
  }
}

export type ServicioSistema = ReturnType<typeof crearServicioSistema>
