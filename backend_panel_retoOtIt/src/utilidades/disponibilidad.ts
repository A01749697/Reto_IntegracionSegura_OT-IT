// Calcula el historial de disponibilidad a partir de cuántas lecturas llegaron en cada tramo de tiempo.
// Es una función pura: no consulta la base de datos ni lee el reloj, por eso se prueba fácil.
// Mide la llegada de datos a la nube, no si la API o la base estuvieron arriba.
import type { ActividadLecturas } from '../repositorios/lecturas.repositorio'

export type Ventana = '24h' | '7d'

export type EstadoCubeta =
  'con_datos' | 'sin_datos' | 'sin_historial' | 'en_curso'

export type Cubeta = {
  inicio: string
  lecturas: number
  estado: EstadoCubeta
}

export type Corte = { desde: string; hasta: string; enCurso: boolean }

export type Disponibilidad = {
  ventana: Ventana
  cubetaSegundos: number
  hasta: string
  cubetas: Cubeta[]
  resumen: {
    // null cuando todavía no hay ningún tramo completo que evaluar
    porcentaje: number | null
    cubetasEvaluadas: number
    cubetasConDatos: number
    interrupciones: number
    mayorCorteSegundos: number
  }
  // las interrupciones más recientes primero
  cortes: Corte[]
}

type Entrada = {
  ventana: Ventana
  cubetaSegundos: number
  cantidad: number
  maximoCortes: number
  actividad: ActividadLecturas
}

const aSegundos = (fecha: Date): number => Math.floor(fecha.getTime() / 1000)
const aIso = (segundos: number): string =>
  new Date(segundos * 1000).toISOString()

export function calcularDisponibilidad({
  ventana,
  cubetaSegundos,
  cantidad,
  maximoCortes,
  actividad,
}: Entrada): Disponibilidad {
  const ahora = aSegundos(actividad.ahora)
  const primera = actividad.primera ? aSegundos(actividad.primera) : null
  const ultimoInicio = Math.floor(ahora / cubetaSegundos) * cubetaSegundos
  const primerInicio = ultimoInicio - (cantidad - 1) * cubetaSegundos

  const lecturasPorInicio = new Map<number, number>()
  for (const c of actividad.cubetas) {
    lecturasPorInicio.set(aSegundos(c.inicio), c.lecturas)
  }

  const cubetas: Cubeta[] = []
  for (
    let inicio = primerInicio;
    inicio <= ultimoInicio;
    inicio += cubetaSegundos
  ) {
    const lecturas = lecturasPorInicio.get(inicio) ?? 0
    const enCurso = inicio === ultimoInicio
    let estado: EstadoCubeta
    if (lecturas > 0) estado = 'con_datos'
    else if (primera === null || inicio + cubetaSegundos <= primera)
      estado = 'sin_historial'
    else estado = enCurso ? 'en_curso' : 'sin_datos'
    cubetas.push({ inicio: aIso(inicio), lecturas, estado })
  }

  // Solo cuentan los tramos completos; el último sigue abierto.
  const completas = cubetas.slice(0, -1)
  const ultimaCubeta = cubetas[cubetas.length - 1]
  if (!ultimaCubeta) throw new Error('La ventana no tiene cubetas')
  const evaluadas = completas.filter((c) => c.estado !== 'sin_historial')
  const conDatos = evaluadas.filter((c) => c.estado === 'con_datos').length

  // Una interrupción es una racha seguida de tramos completos sin lecturas.
  const cortes: Corte[] = []
  let desde: number | null = null
  const cerrar = (finTramo: number, llegaAlFinal: boolean) => {
    if (desde === null) return
    const sigueAbierta = llegaAlFinal && ultimaCubeta.estado !== 'con_datos'
    cortes.push({
      desde: aIso(desde),
      hasta: aIso(sigueAbierta ? ahora : finTramo),
      enCurso: sigueAbierta,
    })
    desde = null
  }
  completas.forEach((c, i) => {
    const inicio = aSegundos(new Date(c.inicio))
    if (c.estado === 'sin_datos') {
      if (desde === null) desde = inicio
    } else {
      cerrar(inicio, false)
    }
    if (i === completas.length - 1) cerrar(inicio + cubetaSegundos, true)
  })

  const mayorCorteSegundos = cortes.reduce(
    (mayor, c) =>
      Math.max(
        mayor,
        aSegundos(new Date(c.hasta)) - aSegundos(new Date(c.desde)),
      ),
    0,
  )

  return {
    ventana,
    cubetaSegundos,
    hasta: aIso(ahora),
    cubetas,
    resumen: {
      porcentaje:
        evaluadas.length === 0
          ? null
          : Math.round((conDatos / evaluadas.length) * 1000) / 10,
      cubetasEvaluadas: evaluadas.length,
      cubetasConDatos: conDatos,
      interrupciones: cortes.length,
      mayorCorteSegundos,
    },
    cortes: cortes.reverse().slice(0, maximoCortes),
  }
}
