// Cuentas de la vista de dirección: los periodos que se comparan y los indicadores que
// salen de sumar los tramos.
import type { Cubeta, Tramo } from './apiIndicadores'

export type Periodo = 'hoy' | '7d' | '30d'

export type Ventana = { desde: Date; hasta: Date; cubeta: Cubeta }

const DIAS: Record<Periodo, number> = { hoy: 1, '7d': 7, '30d': 30 }

// El periodo termina al acabar el día de hoy (hora local) y empieza N días antes.
// Hoy va por hora; los demás, por día. El anterior es el mismo largo justo antes.
export function ventanas(
  periodo: Periodo,
  ahora: Date,
): { actual: Ventana; anterior: Ventana } {
  const manana = new Date(ahora)
  manana.setHours(24, 0, 0, 0)
  const dias = DIAS[periodo]
  const atras = (fecha: Date, n: number) => {
    const otra = new Date(fecha)
    otra.setDate(otra.getDate() - n)
    return otra
  }
  const cubeta: Cubeta = periodo === 'hoy' ? 'hora' : 'dia'
  const desde = atras(manana, dias)
  return {
    actual: { desde, hasta: manana, cubeta },
    anterior: { desde: atras(desde, dias), hasta: desde, cubeta },
  }
}

export type Totales = {
  aluminio: number
  plastico: number
  piezas: number
  marcha: number
  mantenimiento: number
  paro: number
  sinRegistro: number
  paros: number
  fallas: number
  ciclos: number
  segundosCiclo: number
}

export function sumar(tramos: readonly Tramo[]): Totales {
  const t: Totales = {
    aluminio: 0,
    plastico: 0,
    piezas: 0,
    marcha: 0,
    mantenimiento: 0,
    paro: 0,
    sinRegistro: 0,
    paros: 0,
    fallas: 0,
    ciclos: 0,
    segundosCiclo: 0,
  }
  for (const tramo of tramos) {
    t.aluminio += tramo.aluminio
    t.plastico += tramo.plastico
    t.marcha += tramo.marcha
    t.mantenimiento += tramo.mantenimiento
    t.paro += tramo.paro
    t.sinRegistro += tramo.sinRegistro
    t.paros += tramo.paros
    t.fallas += tramo.fallas
    t.ciclos += tramo.ciclos
    t.segundosCiclo += tramo.segundosCiclo
  }
  t.piezas = t.aluminio + t.plastico
  return t
}

// Disponibilidad: marcha / (marcha + paro). El mantenimiento es paro planeado y no cuenta.
export const disponibilidad = (t: {
  marcha: number
  paro: number
}): number | null =>
  t.marcha + t.paro > 0 ? (t.marcha / (t.marcha + t.paro)) * 100 : null

// Piezas por cada hora en marcha.
export const piezasPorHora = (t: Totales): number | null =>
  t.marcha >= 60 ? t.piezas / (t.marcha / 3600) : null

export const cicloPromedio = (t: {
  ciclos: number
  segundosCiclo: number
}): number | null => (t.ciclos > 0 ? t.segundosCiclo / t.ciclos : null)

// Cambio contra el periodo anterior: en porcentaje para cantidades, en puntos para
// porcentajes. null si no hay con qué comparar.
export function cambioRelativo(
  actual: number | null,
  anterior: number | null,
): number | null {
  if (actual === null || anterior === null || anterior === 0) return null
  return ((actual - anterior) / anterior) * 100
}

export function cambioEnPuntos(
  actual: number | null,
  anterior: number | null,
): number | null {
  if (actual === null || anterior === null) return null
  return actual - anterior
}

// Una fila por tramo para descargar como CSV (se abre en Excel).
export function csvDeTramos(
  tramos: readonly Tramo[],
  encabezados: readonly string[],
): string {
  const filas = tramos.map((t) => {
    const ciclo = cicloPromedio(t)
    const disp = disponibilidad(t)
    return [
      t.inicio,
      t.aluminio,
      t.plastico,
      t.aluminio + t.plastico,
      (t.marcha / 3600).toFixed(2),
      (t.mantenimiento / 3600).toFixed(2),
      (t.paro / 3600).toFixed(2),
      (t.sinRegistro / 3600).toFixed(2),
      disp === null ? '' : disp.toFixed(1),
      t.paros,
      t.fallas,
      t.ciclos,
      ciclo === null ? '' : ciclo.toFixed(1),
    ].join(',')
  })
  return [encabezados.join(','), ...filas].join('\r\n') + '\r\n'
}

// Cuántas veces salió cada código de falla, de la más frecuente a la menos.
export function fallasPorCodigo(
  fallas: readonly { codigo: number | null }[],
): { codigo: number | null; veces: number }[] {
  const conteo = new Map<number | null, number>()
  for (const { codigo } of fallas)
    conteo.set(codigo, (conteo.get(codigo) ?? 0) + 1)
  return [...conteo.entries()]
    .map(([codigo, veces]) => ({ codigo, veces }))
    .sort((a, b) => b.veces - a.veces || (a.codigo ?? 0) - (b.codigo ?? 0))
}
