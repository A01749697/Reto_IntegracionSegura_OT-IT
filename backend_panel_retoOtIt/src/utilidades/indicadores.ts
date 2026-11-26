// Indicadores de la celda por tramo (hora o día) para la vista de dirección.
// Todo sale de los cambios que guarda el historian del S7-1516:
//   TAB_ALUMINIO / TAB_OTRAS: contadores de piezas (cuenta lo que suben; una bajada es un reinicio)
//   TAB_TORRETA: 1 = verde (marcha); cualquier otro valor = paro
//   TAB_PASO: la secuencia 0..9; un ciclo va de que sale del reposo a que vuelve a empezar
//   LATIDO: solo sirve para saber que la celda sigue mandando datos
//
// El colector solo guarda cuando un valor cambia. Si en un rato no llega ningún cambio de
// ningún nodo, no se sabe si la celda estaba parada o apagada: ese tiempo es "sin registro".

export type Punto = { ts: Date; valor: number }

export type Series = {
  aluminio: Punto[]
  otras: Punto[]
  pasos: Punto[]
  torreta: Punto[]
  latido: Punto[]
}

export type CubetaIndicadores = {
  inicio: Date
  aluminio: number
  plastico: number
  marcha: number // segundos con la torreta en verde
  paro: number // segundos con la torreta en otro estado, con la celda mandando datos
  sinRegistro: number // segundos sin ningún dato
  paros: number // veces que la torreta salió de verde
  ciclos: number // ciclos completos que terminaron en el tramo
  segundosCiclo: number // suma de sus duraciones
}

export type Opciones = {
  desde: Date
  hasta: Date
  cubetaSegundos: number
  ahora: Date // lo que todavía no pasa no cuenta como tiempo sin registro
  huecoSegundos?: number
}

// Pasado este tiempo sin ningún cambio, se deja de suponer que la celda sigue igual.
export const HUECO_SEGUNDOS = 5 * 60

const VERDE = 1

export function calcularIndicadores(
  series: Series,
  {
    desde,
    hasta,
    cubetaSegundos,
    ahora,
    huecoSegundos = HUECO_SEGUNDOS,
  }: Opciones,
): CubetaIndicadores[] {
  const t0 = desde.getTime()
  const t1 = hasta.getTime()
  const largo = cubetaSegundos * 1000
  const cantidad = Math.max(1, Math.ceil((t1 - t0) / largo))
  const cubetas: CubetaIndicadores[] = Array.from(
    { length: cantidad },
    (_, i) => ({
      inicio: new Date(t0 + i * largo),
      aluminio: 0,
      plastico: 0,
      marcha: 0,
      paro: 0,
      sinRegistro: 0,
      paros: 0,
      ciclos: 0,
      segundosCiclo: 0,
    }),
  )
  const indice = (t: number) =>
    Math.min(cantidad - 1, Math.max(0, Math.floor((t - t0) / largo)))
  // la cubeta donde cae un instante (siempre existe: indice ya lo acota)
  const cubetaEn = (t: number) => cubetas[indice(t)] as CubetaIndicadores
  const dentro = (t: number) => t > t0 && t <= t1
  const ordenar = (puntos: Punto[]) =>
    [...puntos].sort((a, b) => a.ts.getTime() - b.ts.getTime())

  // piezas: lo que sube cada contador, en el tramo en que subió
  const contar = (puntos: Punto[], campo: 'aluminio' | 'plastico') => {
    let anterior: number | null = null
    for (const p of ordenar(puntos)) {
      const t = p.ts.getTime()
      if (t > t1) break
      if (dentro(t) && anterior !== null && p.valor > anterior)
        cubetaEn(t)[campo] += p.valor - anterior
      anterior = p.valor
    }
  }
  contar(series.aluminio, 'aluminio')
  contar(series.otras, 'plastico')

  // reparte un tramo de tiempo entre las cubetas que toca
  const sumarTiempo = (
    inicio: number,
    fin: number,
    campo: 'marcha' | 'paro' | 'sinRegistro',
  ) => {
    let a = Math.max(inicio, t0)
    const b = Math.min(fin, t1)
    while (a < b) {
      const corte = Math.min(b, t0 + (indice(a) + 1) * largo)
      cubetaEn(a)[campo] += (corte - a) / 1000
      a = corte
    }
  }

  // uso del tiempo: entre un cambio y el siguiente la celda sigue igual, hasta el hueco
  const torreta = ordenar(series.torreta)
  const eventos = [
    ...series.aluminio,
    ...series.otras,
    ...series.pasos,
    ...series.torreta,
    ...series.latido,
  ]
    .map((p) => p.ts.getTime())
    .sort((a, b) => a - b)
  const limite = Math.min(t1, ahora.getTime())
  const hueco = huecoSegundos * 1000
  let iTorreta = 0
  let estado: number | null = null
  let cubierto = t0 // hasta dónde ya se repartió el tiempo
  for (const [i, e] of eventos.entries()) {
    if (e > limite) break
    // el estado de la torreta en este instante: el último cambio que ya pasó
    let cambio = torreta[iTorreta]
    while (cambio && cambio.ts.getTime() <= e) {
      estado = cambio.valor
      cambio = torreta[++iTorreta]
    }
    const siguiente = Math.min(eventos[i + 1] ?? Infinity, limite)
    const finCubierto = Math.min(siguiente, e + hueco)
    if (e > cubierto) sumarTiempo(cubierto, e, 'sinRegistro')
    const campo =
      estado === null ? 'sinRegistro' : estado === VERDE ? 'marcha' : 'paro'
    sumarTiempo(Math.max(e, cubierto), finCubierto, campo)
    cubierto = Math.max(cubierto, finCubierto)
  }
  if (cubierto < limite) sumarTiempo(cubierto, limite, 'sinRegistro')

  // paros: cada vez que la torreta sale de verde
  let anterior: number | null = null
  for (const p of torreta) {
    const t = p.ts.getTime()
    if (t > t1) break
    if (dentro(t) && anterior === VERDE && p.valor !== VERDE)
      cubetaEn(t).paros++
    anterior = p.valor
  }

  // ciclos completos: de que el paso sale del reposo (0 o 1) a que la secuencia vuelve a empezar
  let pasoAnterior: number | null = null
  let inicioCiclo: number | null = null
  for (const p of ordenar(series.pasos)) {
    const t = p.ts.getTime()
    if (t > t1) break
    if (t <= t0) {
      pasoAnterior = p.valor
      continue
    }
    if (pasoAnterior !== null && p.valor < pasoAnterior) {
      if (inicioCiclo !== null) {
        const duracion = (t - inicioCiclo) / 1000
        // un ciclo de más de un hueco es una celda que se quedó parada, no un ciclo
        if (duracion <= huecoSegundos) {
          cubetaEn(t).ciclos++
          cubetaEn(t).segundosCiclo += duracion
        }
      }
      inicioCiclo = p.valor >= 2 ? t : null
    } else if (p.valor >= 2 && (pasoAnterior === null || pasoAnterior <= 1)) {
      inicioCiclo = t
    }
    pasoAnterior = p.valor
  }

  return cubetas
}
