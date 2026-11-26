import { describe, expect, it } from 'vitest'
import {
  avanzarGemelo,
  crearGemelo,
  meterPiezas,
  ponerModo,
  ponerPasoInicial,
  ponerTorreta,
  ponerVelocidad,
  recibirPasosReales,
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
  const T0 = Date.parse('2026-11-24T20:00:00.000Z')

  // Los cambios de TAB_PASO como los da /historial: un paso cada `cada` segundos.
  const pasos = (lista: number[], desde = T0, cada = 1.2) =>
    lista.map((valor, i) => ({
      ts: new Date(desde + i * cada * 1000).toISOString(),
      valor,
    }))

  // Prepara el gemelo como queda tras la primera consulta (la celda en reposo).
  function enReposo() {
    const gemelo = crearGemelo('vivo')
    recibirPasosReales(gemelo, pasos([0], T0 - 60_000))
    return gemelo
  }

  // Corre y anota cada paso real que el gemelo mostró.
  function recorrido(gemelo: Gemelo, segundos: number) {
    const vistos: number[] = []
    for (let t = 0; t < segundos; t += 0.05) {
      avanzarGemelo(gemelo, 0.05)
      const paso = gemelo.senales.pasoReal
      if (paso !== null && paso !== vistos[vistos.length - 1]) vistos.push(paso)
    }
    return vistos
  }

  const enAlmacen = (gemelo: Gemelo) =>
    gemelo.planta.piezas.filter((p) => p.estado === 'almacen').length

  it('sin pasos reales los pistones no se mueven, aunque la torreta esté en verde', () => {
    const gemelo = crearGemelo('vivo')
    ponerTorreta(gemelo, true)
    const antes = enAlmacen(gemelo)
    correr(gemelo, 10)
    expect(enAlmacen(gemelo)).toBe(antes)
    expect(gemelo.senales.torreVerde).toBe(true)
    expect(gemelo.senales.pasoReal).toBeNull()
  })

  it('la primera consulta solo dice en qué paso quedó la celda, sin repetir historia', () => {
    const gemelo = crearGemelo('vivo')
    const antes = enAlmacen(gemelo)
    recibirPasosReales(gemelo, pasos([2, 3, 4, 5, 6, 8, 9], T0 - 60_000))
    expect(recorrido(gemelo, 3)).toEqual([9])
    expect(enAlmacen(gemelo)).toBe(antes)
  })

  it('repite un ciclo real: empuja, sella según el material y la pieza termina clasificada', () => {
    const gemelo = enReposo()
    meterPiezas(gemelo, ['pl'])
    recibirPasosReales(gemelo, pasos([1, 2, 3, 4, 5, 7, 8, 9, 0]))
    const vistos = recorrido(gemelo, 20)
    expect(vistos).toEqual([0, 1, 2, 3, 4, 5, 7, 8, 9, 0])
    correrHasta(gemelo, () => piezas(gemelo) === 1)
    expect(gemelo.senales.piezasPl).toBe(1)
    const pieza = gemelo.planta.ultimaSacada
    expect(pieza?.tipo).toBe('pl')
    expect(pieza?.marcada).toBe(true)
    expect(pieza?.sello).toBe('pl')
  })

  it('pasa por los pasos que no quedaron en el historian, con el sello del material', () => {
    const gemelo = enReposo()
    meterPiezas(gemelo, ['al'])
    // al colector se le fueron el 0, el 1, el 4 y el sello
    recibirPasosReales(gemelo, pasos([2, 3, 5, 8, 9], T0, 1.5))
    expect(recorrido(gemelo, 20)).toEqual([0, 1, 2, 3, 4, 5, 6, 8, 9])
    expect(gemelo.planta.ultimaSacada?.sello).toBe('al')
  })

  it('el paso de sello real manda, aunque el contador diga otro material', () => {
    const gemelo = enReposo()
    meterPiezas(gemelo, ['al'])
    recibirPasosReales(gemelo, pasos([2, 3, 4, 5, 7, 8, 9]))
    recorrido(gemelo, 20)
    // así se ve en la escena cuando el sello y el sensor no coinciden
    expect(gemelo.planta.ultimaSacada?.tipo).toBe('al')
    expect(gemelo.planta.ultimaSacada?.sello).toBe('pl')
  })

  it('si el contador llega después de que la pieza salió, la pieza gris toma su material', () => {
    const gemelo = enReposo()
    recibirPasosReales(gemelo, pasos([2, 3, 4, 5]))
    recorrido(gemelo, 11)
    const pieza = gemelo.planta.ultimaSacada
    expect(pieza?.conocida).toBe(false)
    meterPiezas(gemelo, ['al'])
    expect(pieza?.conocida).toBe(true)
    expect(pieza?.tipo).toBe('al')
    expect(gemelo.porEntrar).toEqual([])
  })

  it('en el almacén solo tienen color las piezas ya contadas; las demás son grises', () => {
    const gemelo = enReposo()
    const almacen = () =>
      gemelo.planta.piezas
        .filter((p) => p.estado === 'almacen')
        .sort((a, b) => a.fila - b.fila)
    expect(almacen().every((p) => !p.conocida)).toBe(true)
    meterPiezas(gemelo, ['pl', 'al'])
    const [primera, segunda, tercera] = almacen()
    expect([primera.tipo, primera.conocida]).toEqual(['pl', true])
    expect([segunda.tipo, segunda.conocida]).toEqual(['al', true])
    expect(tercera.conocida).toBe(false)
  })

  it('sin historial, muestra el paso de la última lectura; el historial manda después', () => {
    const gemelo = crearGemelo('vivo')
    ponerPasoInicial(gemelo, 8)
    expect(recorrido(gemelo, 1)).toEqual([8])
    recibirPasosReales(gemelo, pasos([5], T0 - 60_000))
    ponerPasoInicial(gemelo, 8)
    expect(recorrido(gemelo, 3)).toEqual([9, 0, 1, 2, 3, 4, 5])
  })

  it('no acumula más de las últimas seis piezas contadas', () => {
    const gemelo = enReposo()
    meterPiezas(gemelo, Array(10).fill('pl'))
    expect(gemelo.porEntrar).toHaveLength(6)
  })

  it('en simulación no se usan los pasos ni los contadores reales', () => {
    const gemelo = crearGemelo('simulacion')
    meterPiezas(gemelo, ['al'])
    recibirPasosReales(gemelo, pasos([2, 3]))
    expect(gemelo.porEntrar).toEqual([])
    expect(gemelo.repeticion.paso).toBeNull()
    expect(gemelo.planta.piezas.every((p) => p.conocida)).toBe(true)
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
