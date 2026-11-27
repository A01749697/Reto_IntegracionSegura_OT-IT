// Cálculos del tablero a partir del historial de la celda (S7-1516). Son funciones puras:
// reciben los puntos como los da /historial ({ ts, valor }, en orden) y una ventana de tiempo.
//
// Los puntos se piden desde un poco antes de la ventana: así se sabe cuánto marcaba cada
// contador y en qué estado estaba la celda justo cuando empieza.

export type Punto = { ts: string; valor: number }

export type Ventana = { desde: number; hasta: number } // ms

const ms = (p: Punto) => Date.parse(p.ts)

// El último valor antes (o justo en) un instante, si hay.
function valorEn(puntos: readonly Punto[], instante: number): number | null {
  let valor: number | null = null
  for (const p of puntos) {
    if (ms(p) > instante) break
    valor = p.valor
  }
  return valor
}

export type Cubeta = { inicio: number; fin: number; al: number; pl: number }

// Cuánto subió un contador en cada tramo. Una bajada (el PLC se reinició) no cuenta piezas:
// el contador vuelve a empezar desde ese valor.
function subidasPorTramo(
  puntos: readonly Punto[],
  ventana: Ventana,
  tramos: number,
): number[] {
  const largo = (ventana.hasta - ventana.desde) / tramos
  const cuentas = Array<number>(tramos).fill(0)
  let anterior = valorEn(puntos, ventana.desde)
  for (const p of puntos) {
    const t = ms(p)
    if (t <= ventana.desde) continue
    if (t > ventana.hasta) break
    if (anterior !== null && p.valor > anterior) {
      const i = Math.min(tramos - 1, Math.floor((t - ventana.desde) / largo))
      cuentas[i] += p.valor - anterior
    }
    anterior = p.valor
  }
  return cuentas
}

// Las piezas de cada material, repartidas en tramos iguales de la ventana.
export function piezasPorTramo(
  aluminio: readonly Punto[],
  otras: readonly Punto[],
  ventana: Ventana,
  tramos: number,
): Cubeta[] {
  const al = subidasPorTramo(aluminio, ventana, tramos)
  const pl = subidasPorTramo(otras, ventana, tramos)
  const largo = (ventana.hasta - ventana.desde) / tramos
  return al.map((_, i) => ({
    inicio: ventana.desde + i * largo,
    fin: ventana.desde + (i + 1) * largo,
    al: al[i],
    pl: pl[i],
  }))
}

// Cuánto se movió un contador en toda la ventana (sin contar bajadas).
export const totalContador = (puntos: readonly Punto[], ventana: Ventana) =>
  subidasPorTramo(puntos, ventana, 1)[0]

export type Tramo = { valor: number; inicio: number; fin: number }

// La ventana partida en tramos con el mismo valor (un paso, un color de la torreta).
// Antes del primer dato que se conoce no hay tramo.
export function tramos(puntos: readonly Punto[], ventana: Ventana): Tramo[] {
  const lista: Tramo[] = []
  let valor = valorEn(puntos, ventana.desde)
  let inicio = ventana.desde
  for (const p of puntos) {
    const t = ms(p)
    if (t <= ventana.desde) continue
    if (t > ventana.hasta) break
    if (p.valor === valor) continue
    if (valor !== null && t > inicio) lista.push({ valor, inicio, fin: t })
    valor = p.valor
    inicio = t
  }
  if (valor !== null && ventana.hasta > inicio)
    lista.push({ valor, inicio, fin: ventana.hasta })
  return lista
}

// Segundos en cada valor, sumando todos sus tramos.
export function tiempoPorValor(
  puntos: readonly Punto[],
  ventana: Ventana,
): Map<number, number> {
  const tiempos = new Map<number, number>()
  for (const { valor, inicio, fin } of tramos(puntos, ventana))
    tiempos.set(valor, (tiempos.get(valor) ?? 0) + (fin - inicio) / 1000)
  return tiempos
}

// Duración de cada ciclo, en segundos. Un ciclo termina cuando la secuencia vuelve a
// empezar: el paso baja (9 → 0, o 8 → 0 si el historian no alcanzó a ver el 9).
// El primer ciclo y el que va a medias no se cuentan porque no se vieron completos.
export function duracionesDeCiclo(
  pasos: readonly Punto[],
  ventana: Ventana,
): number[] {
  const duraciones: number[] = []
  let anterior: number | null = valorEn(pasos, ventana.desde)
  let inicioCiclo: number | null = null
  for (const p of pasos) {
    const t = ms(p)
    if (t <= ventana.desde) continue
    if (t > ventana.hasta) break
    if (anterior !== null && p.valor < anterior) {
      // la secuencia volvió a empezar; si se saltó el reposo, ya va el siguiente ciclo
      if (inicioCiclo !== null) duraciones.push((t - inicioCiclo) / 1000)
      inicioCiclo = p.valor >= 2 ? t : null
    } else if (p.valor >= 2 && (anterior === null || anterior <= 1)) {
      // empieza un ciclo: el paso sale del reposo (0 o 1) hacia la secuencia
      inicioCiclo = t
    }
    anterior = p.valor
  }
  return duraciones
}

export type Resumen = { promedio: number; minimo: number; maximo: number }

export function resumir(valores: readonly number[]): Resumen | null {
  if (valores.length === 0) return null
  const suma = valores.reduce((a, b) => a + b, 0)
  return {
    promedio: suma / valores.length,
    minimo: Math.min(...valores),
    maximo: Math.max(...valores),
  }
}

// "45 s", "3 min 20 s", "2 h 5 min"
export function segundosLegibles(segundos: number): string {
  const s = Math.round(segundos)
  if (s < 60) return `${s} s`
  const minutos = Math.floor(s / 60)
  if (minutos < 60) {
    const resto = s % 60
    return resto === 0 ? `${minutos} min` : `${minutos} min ${resto} s`
  }
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`
}

// Estado de la celda en cada momento, combinando TAB_TORRETA y TAB_FALLA:
//   1 marcha · 2 mantenimiento · 3 paro · 4 reset · 5 falla (torreta en 3 con TAB_FALLA)
export const ESTADO_FALLA = 5

export function estadosDeLaCelda(
  torreta: readonly Punto[],
  falla: readonly Punto[],
): Punto[] {
  const eventos = [
    ...torreta.map((p) => ({ ms: ms(p), torreta: p.valor })),
    ...falla.map((p) => ({ ms: ms(p), falla: p.valor })),
  ].sort((a, b) => a.ms - b.ms)
  let t: number | null = null
  let f = 0
  const estados: Punto[] = []
  for (const e of eventos) {
    if ('torreta' in e) t = e.torreta
    else f = e.falla
    if (t === null) continue
    const estado = t === 3 && f === 1 ? ESTADO_FALLA : t
    estados.push({ ts: new Date(e.ms).toISOString(), valor: estado })
  }
  return estados
}

export type Falla = {
  inicio: number
  fin: number | null
  codigo: number | null
}

// Cada vez que TAB_FALLA se activó en la ventana, con su código y cuándo se borró.
// El código puede llegar en la misma lectura o un poco después: se toma el de 2 s después.
export function fallasEnVentana(
  falla: readonly Punto[],
  codigos: readonly Punto[],
  ventana: Ventana,
): Falla[] {
  const codigoEn = (t: number) => {
    let codigo: number | null = null
    for (const p of codigos) {
      if (ms(p) > t + 2000) break
      codigo = p.valor
    }
    return codigo
  }
  const lista: Falla[] = []
  let anterior: number | null = null
  for (const p of falla) {
    const t = ms(p)
    if (t > ventana.hasta) break
    if (anterior !== 1 && p.valor === 1 && t > ventana.desde)
      lista.push({ inicio: t, fin: null, codigo: codigoEn(t) })
    const ultima = lista[lista.length - 1]
    if (anterior === 1 && p.valor !== 1 && ultima && ultima.fin === null)
      ultima.fin = t
    anterior = p.valor
  }
  return lista
}

// Los valores que llegaron dentro de la ventana (un valor por ciclo, como TAB_T_CICLO_S).
export const valoresEnVentana = (puntos: readonly Punto[], ventana: Ventana) =>
  puntos.filter(
    (p) => ms(p) > ventana.desde && ms(p) <= ventana.hasta && p.valor > 0,
  )
