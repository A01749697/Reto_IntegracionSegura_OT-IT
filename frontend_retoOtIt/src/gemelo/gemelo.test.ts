import { describe, expect, it } from 'vitest'
import {
  avanzarGemelo,
  crearGemelo,
  ponerModo,
  ponerTorreta,
  ponerVelocidad,
  tomarInstantanea,
  type Gemelo,
} from './gemelo'
import { X_TOMA } from './medidas'

// Avanza en cuadros de 50 ms, como lo haría la pantalla.
function correr(gemelo: Gemelo, segundos: number) {
  for (let t = 0; t < segundos; t += 0.05) avanzarGemelo(gemelo, 0.05)
}

// Avanza hasta que se cumpla la condición (o se acabe el tiempo).
function correrHasta(gemelo: Gemelo, condicion: () => boolean, maximo = 30) {
  for (let t = 0; t < maximo && !condicion(); t += 0.05)
    avanzarGemelo(gemelo, 0.05)
}

const piezas = (gemelo: Gemelo) =>
  gemelo.senales.piezasAl + gemelo.senales.piezasPl

const enDeposito = (gemelo: Gemelo) =>
  gemelo.planta.piezas.filter(
    (p) => p.estado === 'linea' && Math.abs(p.x - X_TOMA) < 0.005,
  )

describe('gemelo en simulación', () => {
  it('arranca con la torreta en verde y sin banda: la pieza baja sola hasta el depósito', () => {
    const gemelo = crearGemelo('simulacion')
    expect(gemelo.senales.torreVerde).toBe(false)
    correr(gemelo, 0.1)
    expect(gemelo.senales.torreVerde).toBe(true)
    expect(gemelo.senales.torreRoja).toBe(false)
    correrHasta(gemelo, () => gemelo.senales.ls4)
    expect(enDeposito(gemelo)).toHaveLength(1)
    expect(gemelo.planta.piezas.filter((p) => p.marcada)).toHaveLength(1)
  })

  it('la garra toma la pieza del depósito y la clasifica con su propio sensor de metal', () => {
    const gemelo = crearGemelo('simulacion')
    correrHasta(gemelo, () => gemelo.senales.tCiclo > 0)
    // la primera pieza del almacén es de aluminio
    expect(gemelo.senales.piezasAl).toBe(1)
    expect(gemelo.senales.piezasPl).toBe(0)
    expect(gemelo.senales.tCiclo).toBeGreaterThan(2)
    expect(gemelo.senales.tCiclo).toBeLessThan(6)
  })

  it('los pistones y la garra trabajan al mismo tiempo', () => {
    const gemelo = crearGemelo('simulacion')
    let juntos = false
    for (let t = 0; t < 12; t += 0.05) {
      avanzarGemelo(gemelo, 0.05)
      if (gemelo.senales.paso > 0 && gemelo.senales.pasoGarra > 0) juntos = true
    }
    expect(juntos).toBe(true)
  })

  it('con la torreta en rojo los pistones terminan su pieza y se detienen; la garra vacía el depósito', () => {
    const gemelo = crearGemelo('simulacion')
    correr(gemelo, 1)
    ponerTorreta(gemelo, false)
    correr(gemelo, 0.1)
    expect(gemelo.senales.torreRoja).toBe(true)
    expect(gemelo.senales.torreVerde).toBe(false)
    correr(gemelo, 20)
    expect(gemelo.plc.pistones.estado).toBe('REPOSO')
    expect(gemelo.plc.garra.estado).toBe('REPOSO')
    expect(gemelo.plc.ciclos).toBe(1)
    expect(piezas(gemelo)).toBe(1)
    expect(gemelo.senales.ls4).toBe(false)
  })

  it('al volver a verde los pistones siguen', () => {
    const gemelo = crearGemelo('simulacion')
    ponerTorreta(gemelo, false)
    correr(gemelo, 5)
    expect(gemelo.plc.ciclos).toBe(0)
    ponerTorreta(gemelo, true)
    correrHasta(gemelo, () => piezas(gemelo) === 1)
    expect(piezas(gemelo)).toBe(1)
  })

  it('la garra no depende de la torreta: si hay pieza en el depósito, la toma aunque esté en rojo', () => {
    const gemelo = crearGemelo('simulacion')
    correrHasta(gemelo, () => gemelo.senales.ls4)
    ponerTorreta(gemelo, false)
    correr(gemelo, 15)
    // todo lo que empezaron los pistones terminó clasificado por la garra
    expect(piezas(gemelo)).toBeGreaterThanOrEqual(1)
    expect(piezas(gemelo)).toBe(gemelo.plc.ciclos)
    expect(gemelo.senales.ls4).toBe(false)
  })

  it('los pistones no sueltan otra pieza mientras el depósito esté ocupado', () => {
    const gemelo = crearGemelo('simulacion')
    for (let t = 0; t < 40; t += 0.05) {
      avanzarGemelo(gemelo, 0.05)
      expect(enDeposito(gemelo).length).toBeLessThanOrEqual(1)
    }
  })

  it('a las cuatro piezas cierra la caja y la pasa a la tarima', () => {
    // el azar alterna para que las piezas recicladas no cambien la cuenta
    let turno = 0
    const gemelo = crearGemelo('simulacion', () => (turno++ % 2 ? 0.9 : 0.1))
    correr(gemelo, 60)
    expect(gemelo.senales.cajasAl).toBeGreaterThanOrEqual(1)
    expect(gemelo.planta.tarima[0]).toBe('al')
  })

  it('la velocidad adelanta la secuencia', () => {
    const lento = crearGemelo('simulacion')
    const rapido = crearGemelo('simulacion')
    ponerVelocidad(rapido, 3)
    correr(lento, 12)
    correr(rapido, 12)
    expect(piezas(rapido)).toBeGreaterThan(piezas(lento))
  })
})

describe('gemelo en vivo', () => {
  it('sin dato de la torreta se queda en paro', () => {
    const gemelo = crearGemelo('vivo')
    correr(gemelo, 10)
    expect(gemelo.plc.ciclos).toBe(0)
    expect(tomarInstantanea(gemelo).paso).toBe(0)
    expect(gemelo.senales.torreRoja).toBe(true)
  })

  it('la torreta real en verde pone a trabajar a los pistones', () => {
    const gemelo = crearGemelo('vivo')
    ponerTorreta(gemelo, true)
    correrHasta(gemelo, () => piezas(gemelo) === 1)
    expect(piezas(gemelo)).toBe(1)
  })

  it('al cambiar de modo empieza limpio', () => {
    const gemelo = crearGemelo('simulacion')
    correr(gemelo, 6)
    ponerModo(gemelo, 'vivo')
    expect(gemelo.senales.marcha).toBe(false)
    expect(gemelo.plc.pistones.estado).toBe('REPOSO')
    expect(gemelo.plc.garra.estado).toBe('REPOSO')
    expect(
      gemelo.planta.piezas.every(
        (p) =>
          p.estado === 'almacen' || p.estado === 'caja' || p.estado === 'cae',
      ),
    ).toBe(true)
    correr(gemelo, 5)
    expect(gemelo.senales.paso).toBe(0)
  })
})
