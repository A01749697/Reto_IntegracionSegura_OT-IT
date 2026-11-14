import { describe, expect, it } from 'vitest'
import { calcularDisponibilidad } from './disponibilidad'

const CUBETA = 900 // 15 min
const AHORA = new Date('2026-11-12T12:07:00.000Z') // la cubeta en curso empieza 12:00

function cubetaConDatos(iso: string, lecturas = 5) {
  return { inicio: new Date(iso), lecturas }
}

function calcular(
  cubetas: { inicio: Date; lecturas: number }[],
  primera: string | null,
  cantidad = 8,
) {
  return calcularDisponibilidad({
    ventana: '24h',
    cubetaSegundos: CUBETA,
    cantidad,
    maximoCortes: 10,
    actividad: {
      ahora: AHORA,
      primera: primera ? new Date(primera) : null,
      cubetas,
    },
  })
}

// Con 8 cubetas y la actual 12:00, empiezan a las 10:15, 10:30, ... 12:00.
const INICIOS = [
  '2026-11-12T10:15:00.000Z',
  '2026-11-12T10:30:00.000Z',
  '2026-11-12T10:45:00.000Z',
  '2026-11-12T11:00:00.000Z',
  '2026-11-12T11:15:00.000Z',
  '2026-11-12T11:30:00.000Z',
  '2026-11-12T11:45:00.000Z',
  '2026-11-12T12:00:00.000Z',
]

describe('calcularDisponibilidad', () => {
  it('arma todas las cubetas aunque la base solo traiga las que tienen datos', () => {
    const r = calcular(
      INICIOS.map((i) => cubetaConDatos(i)),
      '2026-11-01T00:00:00Z',
    )
    expect(r.cubetas.map((c) => c.inicio)).toEqual(INICIOS)
    expect(r.cubetas.every((c) => c.estado === 'con_datos')).toBe(true)
    expect(r.hasta).toBe('2026-11-12T12:07:00.000Z')
    expect(r.cubetaSegundos).toBe(CUBETA)
  })

  it('todo con datos: 100 % y sin interrupciones', () => {
    const r = calcular(
      INICIOS.map((i) => cubetaConDatos(i)),
      '2026-11-01T00:00:00Z',
    )
    expect(r.resumen).toEqual({
      porcentaje: 100,
      cubetasEvaluadas: 7,
      cubetasConDatos: 7,
      interrupciones: 0,
      mayorCorteSegundos: 0,
    })
    expect(r.cortes).toEqual([])
  })

  it('un hueco en medio es una interrupción con su inicio y fin', () => {
    // faltan 10:45 y 11:00
    const con = [0, 1, 4, 5, 6, 7].map((i) => cubetaConDatos(INICIOS[i]))
    const r = calcular(con, '2026-11-01T00:00:00Z')

    expect(r.resumen.cubetasEvaluadas).toBe(7)
    expect(r.resumen.cubetasConDatos).toBe(5)
    expect(r.resumen.porcentaje).toBe(71.4)
    expect(r.resumen.interrupciones).toBe(1)
    expect(r.resumen.mayorCorteSegundos).toBe(1800)
    expect(r.cortes).toEqual([
      {
        desde: '2026-11-12T10:45:00.000Z',
        hasta: '2026-11-12T11:15:00.000Z',
        enCurso: false,
      },
    ])
  })

  it('la cubeta en curso vacía no cuenta como falla', () => {
    const con = INICIOS.slice(0, 7).map((i) => cubetaConDatos(i))
    const r = calcular(con, '2026-11-01T00:00:00Z')
    expect(r.cubetas[7].estado).toBe('en_curso')
    expect(r.resumen.porcentaje).toBe(100)
    expect(r.cortes).toEqual([])
  })

  it('si el hueco llega hasta ahora, la interrupción sigue en curso', () => {
    const con = INICIOS.slice(0, 5).map((i) => cubetaConDatos(i))
    const r = calcular(con, '2026-11-01T00:00:00Z')

    expect(r.resumen.interrupciones).toBe(1)
    expect(r.cortes).toEqual([
      {
        desde: '2026-11-12T11:30:00.000Z',
        hasta: '2026-11-12T12:07:00.000Z',
        enCurso: true,
      },
    ])
    expect(r.resumen.mayorCorteSegundos).toBe(37 * 60)
  })

  it('si el hueco termina con datos en la cubeta en curso, ya no sigue abierta', () => {
    const con = [0, 1, 2, 3, 4, 7].map((i) => cubetaConDatos(INICIOS[i]))
    const r = calcular(con, '2026-11-01T00:00:00Z')
    expect(r.cortes).toEqual([
      {
        desde: '2026-11-12T11:30:00.000Z',
        hasta: '2026-11-12T12:00:00.000Z',
        enCurso: false,
      },
    ])
  })

  it('antes de la primera lectura no se cuenta como falla', () => {
    // la primera lectura llegó a las 11:20; lo anterior es "sin historial"
    const con = INICIOS.slice(4).map((i) => cubetaConDatos(i))
    const r = calcular(con, '2026-11-12T11:20:00Z')

    expect(r.cubetas.slice(0, 4).map((c) => c.estado)).toEqual([
      'sin_historial',
      'sin_historial',
      'sin_historial',
      'sin_historial',
    ])
    expect(r.resumen.cubetasEvaluadas).toBe(3)
    expect(r.resumen.porcentaje).toBe(100)
    expect(r.cortes).toEqual([])
  })

  it('el tramo donde cae la primera lectura sí se evalúa', () => {
    // primera a las 11:20 cae en el tramo 11:15; el tramo 11:00 termina a las 11:15 y no cuenta
    const r = calcular([cubetaConDatos(INICIOS[7])], '2026-11-12T11:20:00Z')
    expect(r.cubetas[3].estado).toBe('sin_historial') // 11:00
    expect(r.cubetas[4].estado).toBe('sin_datos') // 11:15
  })

  it('sin ninguna lectura en la historia: no hay porcentaje', () => {
    const r = calcular([], null)
    expect(r.cubetas.every((c) => c.estado === 'sin_historial')).toBe(true)
    expect(r.resumen).toEqual({
      porcentaje: null,
      cubetasEvaluadas: 0,
      cubetasConDatos: 0,
      interrupciones: 0,
      mayorCorteSegundos: 0,
    })
    expect(r.cortes).toEqual([])
  })

  it('lista primero la interrupción más reciente y respeta el máximo', () => {
    // con datos solo en 10:15, 10:45 y 11:15, 11:45: huecos de una cubeta cada vez
    const con = [0, 2, 4, 6].map((i) => cubetaConDatos(INICIOS[i]))
    const r = calcularDisponibilidad({
      ventana: '24h',
      cubetaSegundos: CUBETA,
      cantidad: 8,
      maximoCortes: 2,
      actividad: {
        ahora: AHORA,
        primera: new Date('2026-11-01T00:00:00Z'),
        cubetas: con,
      },
    })

    expect(r.resumen.interrupciones).toBe(3)
    expect(r.cortes).toHaveLength(2)
    expect(r.cortes[0].desde).toBe('2026-11-12T11:30:00.000Z')
    expect(r.cortes[1].desde).toBe('2026-11-12T11:00:00.000Z')
  })

  it('redondea el porcentaje a un decimal', () => {
    // 1 de 3 tramos completos con datos: 33.3 %
    const r = calcular([cubetaConDatos(INICIOS[4])], '2026-11-12T11:15:00Z')
    expect(r.resumen.cubetasEvaluadas).toBe(3)
    expect(r.resumen.porcentaje).toBe(33.3)
  })
})
