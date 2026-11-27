import { describe, expect, it } from 'vitest'
import {
  calcularIndicadores,
  eventosDeFalla,
  type Punto,
  type Series,
} from './indicadores'

const T0 = Date.parse('2026-11-24T06:00:00.000Z')
// minuto m desde T0
const en = (m: number, valor: number): Punto => ({
  ts: new Date(T0 + m * 60_000),
  valor,
})
const vacias = (): Series => ({
  aluminio: [],
  otras: [],
  pasos: [],
  torreta: [],
  latido: [],
  falla: [],
  codFalla: [],
})
// dos tramos de una hora
const opciones = {
  desde: new Date(T0),
  hasta: new Date(T0 + 120 * 60_000),
  cubetaSegundos: 3600,
  ahora: new Date(T0 + 200 * 60_000),
  huecoSegundos: 300,
}

describe('calcularIndicadores', () => {
  it('cuenta las piezas en el tramo en que sube cada contador', () => {
    const series = vacias()
    series.aluminio = [en(-30, 10), en(10, 11), en(70, 13)]
    series.otras = [en(-30, 5), en(20, 0), en(21, 1)] // se reinició: no resta
    const [a, b] = calcularIndicadores(series, opciones)
    expect([a.aluminio, a.plastico]).toEqual([1, 1])
    expect([b.aluminio, b.plastico]).toEqual([2, 0])
  })

  it('reparte el tiempo en marcha, paro y sin registro', () => {
    const series = vacias()
    // verde desde antes; cambios de paso cada 4 min durante la primera media hora
    series.torreta = [en(-10, 1), en(30, 3)]
    series.pasos = [0, 4, 8, 12, 16, 20, 24, 28].map((m) => en(m, 2))
    const [a, b] = calcularIndicadores(series, opciones)
    // 0-30 marcha; 30-35 paro (5 min de hueco tras el último cambio); lo demás sin registro
    expect(a.marcha).toBe(30 * 60)
    expect(a.paro).toBe(5 * 60)
    expect(a.sinRegistro).toBe(25 * 60)
    expect(b.sinRegistro).toBe(3600)
    expect(a.paros).toBe(1)
  })

  it('lo que todavía no pasa no cuenta', () => {
    const series = vacias()
    series.torreta = [en(0, 1)]
    const [a, b] = calcularIndicadores(series, {
      ...opciones,
      ahora: new Date(T0 + 30 * 60_000),
    })
    expect(a.marcha + a.paro + a.sinRegistro).toBe(30 * 60)
    expect(b.marcha + b.paro + b.sinRegistro).toBe(0)
  })

  it('mide los ciclos completos en el tramo en que terminan', () => {
    const series = vacias()
    series.pasos = [
      en(-1, 5), // va a medias al empezar
      en(1, 0),
      en(2, 2),
      en(2.5, 9),
      en(3, 0), // ciclo de 1 min
      en(59.5, 2),
      en(60.5, 0), // ciclo de 1 min que termina en el segundo tramo
      en(70, 2),
      en(90, 0), // 20 min: la celda se quedó parada, no es un ciclo
    ]
    const [a, b] = calcularIndicadores(series, opciones)
    expect([a.ciclos, a.segundosCiclo]).toEqual([1, 60])
    expect([b.ciclos, b.segundosCiclo]).toEqual([1, 60])
  })

  it('el latido cuenta como señal de vida aunque nada más cambie', () => {
    const series = vacias()
    series.torreta = [en(-10, 3)]
    series.latido = Array.from({ length: 30 }, (_, i) => en(i * 4, i))
    const [a, b] = calcularIndicadores(series, opciones)
    expect(a.paro).toBe(3600)
    expect(b.paro).toBe(3600)
    expect(a.sinRegistro + b.sinRegistro).toBe(0)
  })
})

describe('mantenimiento y fallas', () => {
  it('el mantenimiento se cuenta aparte y entrar a él no es un paro', () => {
    const series = vacias()
    series.torreta = [en(-10, 1), en(10, 2), en(40, 1), en(50, 3)]
    series.latido = Array.from({ length: 15 }, (_, i) => en(i * 4, i))
    const [a] = calcularIndicadores(series, opciones)
    expect(a?.mantenimiento).toBe(30 * 60)
    expect(a?.marcha).toBe(20 * 60)
    expect(a?.paros).toBe(1) // solo la de las 50
  })

  it('cada activación de TAB_FALLA es una falla con su código', () => {
    const series = vacias()
    series.falla = [en(-5, 0), en(10, 1), en(12, 0), en(70, 1)]
    // el código llega un segundo después de la falla
    series.codFalla = [en(-5, 0), en(10 + 1 / 60, 7), en(70, 3)]
    const eventos = eventosDeFalla(series, opciones)
    expect(eventos.map((e) => e.codigo)).toEqual([7, 3])
    const [a, b] = calcularIndicadores(series, opciones)
    expect([a?.fallas, b?.fallas]).toEqual([1, 1])
  })

  it('una falla que ya estaba activa al empezar no se cuenta otra vez', () => {
    const series = vacias()
    series.falla = [en(-5, 1), en(10, 1)]
    expect(eventosDeFalla(series, opciones)).toEqual([])
  })
})
