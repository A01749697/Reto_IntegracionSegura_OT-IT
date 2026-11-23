import { seguridad } from '../configuracion/seguridad'
import { validarConsultaDisponibilidad } from '../esquemas/sistema.esquema'
import type {
  ActividadLecturas,
  EstadoVariable,
} from '../repositorios/lecturas.repositorio'
import type { TamanosBase } from '../repositorios/sistema.repositorio'
import {
  calcularDisponibilidad,
  type Disponibilidad,
} from '../utilidades/disponibilidad'
import { diasRestantes, type Memoria } from '../utilidades/recursos'
import type { Cpu, Disco } from '../utilidades/sondas'

type Parte = 'ok' | 'falla'
export type Datos = 'al_dia' | 'retrasado' | 'sin_datos' | 'desconocido'

export type EstadoSistema = {
  api: 'ok'
  baseDatosPanel: Parte
  baseDatosLecturas: Parte
  datos: Datos
  variables: EstadoVariable[]
}

export type RecursosServidor = {
  generadoEn: string
  disco: Disco | null
  memoria: Memoria | null
  cpu: Cpu | null
  baseDatos: TamanosBase | null
  certificado: { venceEn: string; diasRestantes: number } | null
  servicios: {
    baseDatosPanel: Parte
    baseDatosLecturas: Parte
    apiReceptora: Parte
  }
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
  obtenerTamanosBase: () => Promise<TamanosBase>
  leerDisco: () => Promise<Disco>
  leerMemoria: () => Promise<Memoria>
  leerCpu: () => Cpu
  leerVencimientoCertificado: () => Promise<Date>
  comprobarApiReceptora: () => Promise<void>
  ahora: () => number
}

function avisarFalla(nombre: string, razon: unknown) {
  const mensaje = razon instanceof Error ? razon.message : 'desconocido'
  console.error(`Falla al comprobar ${nombre}:`, mensaje)
}

export function crearServicioSistema({
  comprobarBasePanel,
  obtenerEstadoLecturas,
  obtenerActividadLecturas,
  obtenerTamanosBase,
  leerDisco,
  leerMemoria,
  leerCpu,
  leerVencimientoCertificado,
  comprobarApiReceptora,
  ahora,
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

    // Salud del servidor. Cada medición va por separado: si una falla queda en null
    // y las demás se muestran igual. Todo es de solo lectura.
    async recursos(): Promise<RecursosServidor> {
      const [panel, tamanos, disco, memoria, cpu, certificado, receptora] =
        await Promise.allSettled([
          comprobarBasePanel(),
          obtenerTamanosBase(),
          leerDisco(),
          leerMemoria(),
          // leerCpu es síncrona; se envuelve para que un error no tire todo
          Promise.resolve().then(leerCpu),
          leerVencimientoCertificado(),
          comprobarApiReceptora(),
        ])

      const medidas = [
        ['la base del panel', panel],
        ['el tamaño de la base', tamanos],
        ['el disco', disco],
        ['la memoria', memoria],
        ['el procesador', cpu],
        ['el certificado', certificado],
        ['la API receptora', receptora],
      ] as const
      for (const [nombre, resultado] of medidas) {
        if (resultado.status === 'rejected')
          avisarFalla(nombre, resultado.reason)
      }

      const ahoraMs = ahora()
      return {
        generadoEn: new Date(ahoraMs).toISOString(),
        disco: disco.status === 'fulfilled' ? disco.value : null,
        memoria: memoria.status === 'fulfilled' ? memoria.value : null,
        cpu: cpu.status === 'fulfilled' ? cpu.value : null,
        baseDatos: tamanos.status === 'fulfilled' ? tamanos.value : null,
        certificado:
          certificado.status === 'fulfilled'
            ? {
                venceEn: certificado.value.toISOString(),
                diasRestantes: diasRestantes(certificado.value, ahoraMs),
              }
            : null,
        servicios: {
          baseDatosPanel: panel.status === 'fulfilled' ? 'ok' : 'falla',
          baseDatosLecturas: tamanos.status === 'fulfilled' ? 'ok' : 'falla',
          apiReceptora: receptora.status === 'fulfilled' ? 'ok' : 'falla',
        },
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
