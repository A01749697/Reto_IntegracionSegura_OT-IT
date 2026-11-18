// Convierte las lecturas que llegan de la nube en lo que el gemelo necesita.
// Las cuatro variables son las de configuracion/reglas.ts de la API receptora:
// si esa lista cambia, este es el archivo que hay que ajustar.
import type { UltimaLectura } from './apiLecturas'

export type LecturasCelda = {
  estacion: number | null // estado_estacion: 0 = detenida
  piston: number | null // estado_piston: 0 = atras
  presencia: number | null // presencia_pieza: 0 = sin pieza
  contador: number | null // contador_piezas
  ultima: string | null // fecha de la lectura mas reciente
}

export type Enlace =
  'conectando' | 'en_vivo' | 'atrasado' | 'sin_lecturas' | 'sin_conexion'

const VARIABLES = {
  estado_estacion: 'estacion',
  estado_piston: 'piston',
  presencia_pieza: 'presencia',
  contador_piezas: 'contador',
} as const

// Pasado este tiempo sin lecturas nuevas se avisa que estan atrasadas (igual que en Estado).
export const SEGUNDOS_ATRASO = 5 * 60

export const SIN_LECTURAS: LecturasCelda = {
  estacion: null,
  piston: null,
  presencia: null,
  contador: null,
  ultima: null,
}

const esVariable = (nombre: string): nombre is keyof typeof VARIABLES =>
  Object.hasOwn(VARIABLES, nombre)

// Si dos PLC mandan la misma variable, se queda la lectura mas nueva.
export function resumirLecturas(lecturas: UltimaLectura[]): LecturasCelda {
  const resumen = { ...SIN_LECTURAS }
  const fechas: Record<string, number> = {}
  for (const { variable, valor, ts } of lecturas) {
    const fecha = Date.parse(ts)
    if (!esVariable(variable) || Number.isNaN(fecha)) continue
    const campo = VARIABLES[variable]
    if (fecha > (fechas[campo] ?? -Infinity)) {
      fechas[campo] = fecha
      resumen[campo] = valor
    }
    if (resumen.ultima === null || fecha > Date.parse(resumen.ultima))
      resumen.ultima = ts
  }
  return resumen
}

// Cuantas piezas nuevas conto el PLC desde la lectura anterior.
// La primera lectura solo sirve de punto de partida; si el contador baja es que lo reiniciaron.
export function piezasNuevas(
  anterior: number | null,
  actual: number | null,
): number {
  if (anterior === null || actual === null || actual <= anterior) return 0
  return Math.floor(actual - anterior)
}

// Como quedo el enlace despues de una consulta que si respondio.
export function estadoEnlace(lecturas: LecturasCelda, ahora: number): Enlace {
  if (lecturas.ultima === null) return 'sin_lecturas'
  return ahora - Date.parse(lecturas.ultima) > SEGUNDOS_ATRASO * 1000
    ? 'atrasado'
    : 'en_vivo'
}
