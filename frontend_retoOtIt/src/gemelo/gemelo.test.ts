import { describe, expect, it } from 'vitest'
import {
  avanzarGemelo,
  crearGemelo,
  MAXIMO_CICLOS_PENDIENTES,
  pedirCiclos,
  ponerModo,
  ponerVelocidad,
  pulsar,
  tomarInstantanea,
  type Gemelo,
} from './gemelo'

// Avanza en cuadros de 50 ms, como lo haría la pantalla.
function correr(gemelo: Gemelo, segundos: number) {
  for (let t = 0; t < segundos; t += 0.05) avanzarGemelo(gemelo, 0.05)
}

const piezas = (gemelo: Gemelo) =>
  gemelo.senales.piezasAl + gemelo.senales.piezasPl

describe('gemelo en simulación', () => {
  it('arranca solo y clasifica la primera pieza según su material', () => {
    const gemelo = crearGemelo('simulacion')
    correr(gemelo, 9)
    // la primera pieza del almacén es de aluminio
    expect(gemelo.senales.piezasAl).toBe(1)
    expect(gemelo.senales.piezasPl).toBe(0)
    expect(gemelo.planta.piezas.filter((p) => p.marcada)).toHaveLength(1)
  })

  it('mide lo que tardó el ciclo', () => {
    const gemelo = crearGemelo('simulacion')
    correr(gemelo, 18)
    expect(gemelo.senales.tCiclo).toBeGreaterThan(5)
    expect(gemelo.senales.tCiclo).toBeLessThan(12)
  })

  it('con Paro termina el ciclo que lleva y vuelve a reposo', () => {
    const gemelo = crearGemelo('simulacion')
    correr(gemelo, 3)
    pulsar(gemelo, 'paro')
    expect(tomarInstantanea(gemelo).paso).toBeGreaterThan(0)
    correr(gemelo, 15)
    expect(piezas(gemelo)).toBe(1)
    expect(gemelo.plc.estado).toBe('REPOSO')
    expect(gemelo.senales.torreAmarilla).toBe(true)
  })

  it('el paro de emergencia detiene la banda y no deja dar marcha', () => {
    const gemelo = crearGemelo('simulacion')
    correr(gemelo, 2)
    pulsar(gemelo, 'emergencia')
    correr(gemelo, 1)
    expect(gemelo.plc.estado).toBe('EMERGENCIA')
    expect(gemelo.senales.motorBanda).toBe(false)
    expect(gemelo.senales.torreVerde).toBe(false)
    pulsar(gemelo, 'marcha')
    expect(gemelo.senales.marcha).toBe(false)
  })

  it('Restablecer quita la emergencia y despeja la línea', () => {
    const gemelo = crearGemelo('simulacion')
    correr(gemelo, 2)
    pulsar(gemelo, 'emergencia')
    pulsar(gemelo, 'restablecer')
    correr(gemelo, 1)
    expect(gemelo.senales.emergencia).toBe(false)
    expect(gemelo.plc.estado).toBe('REPOSO')
    expect(gemelo.planta.piezas.every((p) => p.estado === 'almacen')).toBe(true)
    pulsar(gemelo, 'marcha')
    correr(gemelo, 9)
    expect(piezas(gemelo)).toBe(1)
  })

  it('a las cuatro piezas cierra la caja y la pasa a la tarima', () => {
    // el azar alterna para que las piezas recicladas no cambien la cuenta
    let turno = 0
    const gemelo = crearGemelo('simulacion', () => (turno++ % 2 ? 0.9 : 0.1))
    correr(gemelo, 70)
    expect(gemelo.senales.cajasAl).toBe(1)
    expect(gemelo.planta.tarima).toEqual(['al'])
  })

  it('la velocidad adelanta la secuencia', () => {
    const gemelo = crearGemelo('simulacion')
    ponerVelocidad(gemelo, 3)
    correr(gemelo, 9)
    expect(piezas(gemelo)).toBe(3)
  })
})

describe('gemelo en vivo', () => {
  it('sin lecturas se queda en reposo', () => {
    const gemelo = crearGemelo('vivo')
    correr(gemelo, 10)
    expect(gemelo.plc.ciclos).toBe(0)
    expect(tomarInstantanea(gemelo).paso).toBe(0)
  })

  it('hace un ciclo por cada pieza que contó la celda real', () => {
    const gemelo = crearGemelo('vivo')
    pedirCiclos(gemelo, 2)
    correr(gemelo, 40)
    expect(gemelo.plc.ciclos).toBe(2)
    expect(piezas(gemelo)).toBe(2)
    expect(gemelo.plc.estado).toBe('REPOSO')
  })

  it('no acumula ciclos sin fin si la celda real va más rápido', () => {
    const gemelo = crearGemelo('vivo')
    pedirCiclos(gemelo, 500)
    pedirCiclos(gemelo, 500)
    expect(gemelo.ciclosPedidos).toBe(MAXIMO_CICLOS_PENDIENTES)
  })

  it('ignora los mandos: el panel no le ordena nada a la celda', () => {
    const gemelo = crearGemelo('vivo')
    pulsar(gemelo, 'marcha')
    pulsar(gemelo, 'emergencia')
    correr(gemelo, 5)
    expect(gemelo.senales.emergencia).toBe(false)
    expect(gemelo.plc.ciclos).toBe(0)
  })

  it('al cambiar de modo empieza limpio', () => {
    const gemelo = crearGemelo('simulacion')
    correr(gemelo, 3)
    ponerModo(gemelo, 'vivo')
    correr(gemelo, 10)
    expect(gemelo.plc.estado).toBe('REPOSO')
    expect(gemelo.plc.ciclos).toBe(1)
    pedirCiclos(gemelo, 0)
    pedirCiclos(gemelo, -3)
    expect(gemelo.ciclosPedidos).toBe(1)
  })
})
