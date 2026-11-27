import { describe, expect, it } from 'vitest'
import {
  avanzarGemelo,
  crearGemelo,
  mandarSimulacion,
  meterPiezas,
  ponerEnlace,
  ponerModo,
  ponerVelocidad,
  recibirCambiosReales,
  sembrarValores,
  type Gemelo,
} from './gemelo'
import { X_TOMA } from './medidas'
import { NODO, NODOS_TABLERO } from './nodos'

// Avanza en cuadros de 50 ms, como lo haría la pantalla.
function correr(gemelo: Gemelo, segundos: number) {
  for (let t = 0; t < segundos; t += 0.05) avanzarGemelo(gemelo, 0.05)
}

// Avanza hasta que se cumpla la condición (o se acabe el tiempo).
function correrHasta(gemelo: Gemelo, condicion: () => boolean, maximo = 30) {
  for (let t = 0; t < maximo && !condicion(); t += 0.05)
    avanzarGemelo(gemelo, 0.05)
}

// Corre y anota cada valor distinto que tomó algo.
function anotar<T>(gemelo: Gemelo, segundos: number, leer: () => T): T[] {
  const vistos: T[] = []
  for (let t = 0; t < segundos; t += 0.05) {
    avanzarGemelo(gemelo, 0.05)
    const valor = leer()
    if (vistos[vistos.length - 1] !== valor) vistos.push(valor)
  }
  return vistos
}

const piezas = (gemelo: Gemelo) =>
  gemelo.senales.piezasAl + gemelo.senales.piezasPl

const enDeposito = (gemelo: Gemelo) =>
  gemelo.planta.piezas.filter(
    (p) => p.estado === 'linea' && Math.abs(p.x - X_TOMA) < 0.005,
  )

describe('gemelo en simulación', () => {
  it('arranca en marcha: torreta verde, letrero EN MARCHA y la pieza baja hasta el depósito', () => {
    const gemelo = crearGemelo('simulacion')
    correr(gemelo, 0.1)
    expect(gemelo.senales.estado).toBe('marcha')
    expect(gemelo.senales.torreVerde).toBe(true)
    expect(gemelo.senales.torreAmarilla || gemelo.senales.torreRoja).toBe(false)
    correrHasta(gemelo, () => gemelo.senales.ls4)
    expect(enDeposito(gemelo)).toHaveLength(1)
    expect(gemelo.planta.piezas.filter((p) => p.marcada)).toHaveLength(1)
  })

  it('el S7-1516 virtual publica los mismos nodos que el tablero real', () => {
    const gemelo = crearGemelo('simulacion')
    correr(gemelo, 0.5)
    expect(Object.keys(gemelo.valores).sort()).toEqual(
      [...NODOS_TABLERO].sort(),
    )
  })

  it('recorre los pasos del S7-1516 en orden y cuenta la pieza', () => {
    const gemelo = crearGemelo('simulacion')
    const pasos = anotar(gemelo, 12, () => gemelo.valores[NODO.paso])
    expect(pasos.slice(0, 10)).toEqual([0, 1, 2, 3, 4, 5, 6, 8, 9, 0])
    // la primera pieza del almacén es de aluminio: sello 6
    expect(gemelo.valores[NODO.aluminio]).toBe(1)
    expect(gemelo.valores[NODO.ciclos]).toBeGreaterThanOrEqual(1)
    expect(gemelo.valores[NODO.tCiclo]).toBeGreaterThan(2)
    expect(gemelo.valores[NODO.tCarreraPd1]).toBeGreaterThan(0.2)
  })

  it('la garra toma la pieza del depósito y la clasifica con su propio sensor de metal', () => {
    const gemelo = crearGemelo('simulacion')
    correrHasta(gemelo, () => gemelo.senales.tCiclo > 0)
    expect(gemelo.senales.piezasAl).toBe(1)
    expect(gemelo.senales.piezasPl).toBe(0)
  })

  it('los pistones y la garra trabajan al mismo tiempo', () => {
    const gemelo = crearGemelo('simulacion')
    let juntos = false
    for (let t = 0; t < 14; t += 0.05) {
      avanzarGemelo(gemelo, 0.05)
      if (gemelo.senales.paso > 0 && gemelo.senales.pasoGarra > 0) juntos = true
    }
    expect(juntos).toBe(true)
  })

  it('Paro: la secuencia se queda donde iba y la torreta en rojo; Marcha sigue desde ahí', () => {
    const gemelo = crearGemelo('simulacion')
    correrHasta(gemelo, () => gemelo.valores[NODO.paso] === 3)
    mandarSimulacion(gemelo, 'paro')
    correr(gemelo, 5)
    expect(gemelo.valores[NODO.paso]).toBe(3)
    expect(gemelo.valores[NODO.marcha]).toBe(0)
    expect(gemelo.senales.estado).toBe('paro')
    expect(gemelo.senales.torreRoja).toBe(true)
    mandarSimulacion(gemelo, 'marcha')
    correrHasta(gemelo, () => piezas(gemelo) === 1)
    expect(piezas(gemelo)).toBe(1)
  })

  it('Mantenimiento: amarillo fijo y el arranque bloqueado hasta quitarlo', () => {
    const gemelo = crearGemelo('simulacion')
    correr(gemelo, 1)
    mandarSimulacion(gemelo, 'mantenimiento')
    const amarilla = anotar(gemelo, 2, () => gemelo.senales.torreAmarilla)
    expect(amarilla).toEqual([true])
    expect(gemelo.senales.estado).toBe('mantenimiento')
    expect(gemelo.valores[NODO.marcha]).toBe(0)
    mandarSimulacion(gemelo, 'marcha')
    correr(gemelo, 0.5)
    expect(gemelo.senales.estado).toBe('mantenimiento')
    mandarSimulacion(gemelo, 'mantenimiento')
    correr(gemelo, 0.1)
    expect(gemelo.senales.estado).toBe('paro')
    mandarSimulacion(gemelo, 'marcha')
    correr(gemelo, 0.1)
    expect(gemelo.senales.estado).toBe('marcha')
  })

  it('Reset: unos 3 s en amarillo parpadeando, PD-1 se retrae y PD-2 abre; luego queda en paro', () => {
    const gemelo = crearGemelo('simulacion')
    correrHasta(gemelo, () => gemelo.valores[NODO.paso] === 5)
    correr(gemelo, 0.3)
    expect(gemelo.senales.yB).toBe(true)
    mandarSimulacion(gemelo, 'reset')
    correr(gemelo, 0.1)
    expect(gemelo.senales.estado).toBe('reset')
    expect(gemelo.valores[NODO.paso]).toBe(0)
    expect(gemelo.valores[NODO.empujaRet]).toBe(1)
    expect(gemelo.valores[NODO.suelta]).toBe(1)
    const amarilla = anotar(gemelo, 2.5, () => gemelo.senales.torreAmarilla)
    expect(amarilla).toContain(true)
    expect(amarilla).toContain(false)
    expect(gemelo.senales.yB).toBe(false)
    correr(gemelo, 1)
    expect(gemelo.senales.estado).toBe('paro')
    expect(gemelo.valores[NODO.empujaRet]).toBe(0)
    expect(gemelo.planta.extension.A).toBeLessThan(0.02)
  })

  it('PD-1 trabado: la falla 1 sale sola por tiempo, bloquea la marcha y el reset la borra', () => {
    const gemelo = crearGemelo('simulacion')
    mandarSimulacion(gemelo, 'atasco')
    correr(gemelo, 5)
    expect(gemelo.senales.estado).toBe('falla')
    expect(gemelo.senales.codFalla).toBe(1)
    expect(gemelo.valores[NODO.falla]).toBe(1)
    expect(gemelo.senales.torreRoja).toBe(true)
    mandarSimulacion(gemelo, 'marcha')
    correr(gemelo, 0.5)
    expect(gemelo.senales.estado).toBe('falla')
    mandarSimulacion(gemelo, 'reset')
    correr(gemelo, 3.5)
    expect(gemelo.senales.estado).toBe('paro')
    expect(gemelo.valores[NODO.codFalla]).toBe(0)
    expect(gemelo.planta.atasco).toBe(false)
    mandarSimulacion(gemelo, 'marcha')
    correrHasta(gemelo, () => piezas(gemelo) === 1)
    expect(piezas(gemelo)).toBe(1)
  })

  it('sin comunicación: a los 5 s sin latido, letrero SIN COMUNICACIÓN y torreta gris', () => {
    const gemelo = crearGemelo('simulacion')
    correr(gemelo, 1)
    mandarSimulacion(gemelo, 'comunicacion')
    correr(gemelo, 4)
    expect(gemelo.senales.estado).toBe('marcha')
    correr(gemelo, 1.5)
    expect(gemelo.senales.estado).toBe('sinComunicacion')
    expect(gemelo.senales.torreGris).toBe(true)
    expect(
      gemelo.senales.torreVerde ||
        gemelo.senales.torreAmarilla ||
        gemelo.senales.torreRoja,
    ).toBe(false)
    mandarSimulacion(gemelo, 'comunicacion')
    correr(gemelo, 0.5)
    expect(gemelo.senales.estado).toBe('marcha')
    expect(gemelo.senales.torreGris).toBe(false)
  })

  it('no suelta otra pieza mientras el depósito esté ocupado', () => {
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
    correr(gemelo, 70)
    expect(
      gemelo.senales.cajasAl + gemelo.senales.cajasPl,
    ).toBeGreaterThanOrEqual(1)
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

describe('carriles de la garra', () => {
  // Corre la simulación y anota a qué carril (1 a 4) llevó la garra cada pieza.
  function destinos(gemelo: Gemelo, segundos: number) {
    const lista: { carril: number; tipo: string }[] = []
    let anterior = 0
    for (let t = 0; t < segundos; t += 0.05) {
      avanzarGemelo(gemelo, 0.05)
      const { posX, materialGarra } = gemelo.senales
      if (posX !== anterior && posX > 0)
        lista.push({ carril: posX, tipo: materialGarra })
      anterior = posX
    }
    return lista
  }

  it('aluminio va a los carriles 1-2 y plástico a los 3-4, cuatro en cada uno', () => {
    const gemelo = crearGemelo('simulacion')
    ponerVelocidad(gemelo, 4)
    const lista = destinos(gemelo, 200)
    const al = lista.filter((d) => d.tipo === 'al').map((d) => d.carril)
    const pl = lista.filter((d) => d.tipo === 'pl').map((d) => d.carril)
    expect(al.length).toBeGreaterThanOrEqual(9)
    expect(pl.length).toBeGreaterThanOrEqual(9)
    expect(al.slice(0, 9)).toEqual([1, 1, 1, 1, 2, 2, 2, 2, 1])
    expect(pl.slice(0, 9)).toEqual([3, 3, 3, 3, 4, 4, 4, 4, 3])
  })

  it('las piezas se forman en el carril y bajan juntas a la caja cuando son cuatro', () => {
    const gemelo = crearGemelo('simulacion')
    ponerVelocidad(gemelo, 4)
    const enCarril = (i: number) =>
      gemelo.planta.piezas.filter(
        (p) => p.estado === 'carril' && p.carril === i,
      )
    let maximo = 0
    let vacioTrasLleno = false
    for (let t = 0; t < 120; t += 0.05) {
      avanzarGemelo(gemelo, 0.05)
      const n = enCarril(0).length
      if (maximo === 4 && n === 0) vacioTrasLleno = true
      maximo = Math.max(maximo, n)
    }
    expect(maximo).toBe(4)
    expect(vacioTrasLleno).toBe(true)
    expect(gemelo.senales.cajasAl).toBeGreaterThan(0)
  })

  it('no se atora: sigue empacando de los dos materiales mucho rato', () => {
    const gemelo = crearGemelo('simulacion')
    ponerVelocidad(gemelo, 8)
    correr(gemelo, 600)
    expect(gemelo.senales.cajasAl).toBeGreaterThanOrEqual(4)
    expect(gemelo.senales.cajasPl).toBeGreaterThanOrEqual(4)
  }, 30_000)
})

describe('gemelo en vivo', () => {
  const T0 = Date.parse('2026-11-26T20:00:00.000Z')
  const en = (segundos: number, nodo: string, valor: number) => ({
    nodo,
    ts: new Date(T0 + segundos * 1000).toISOString(),
    valor,
  })
  // LATIDO cambiando cada medio segundo hasta `hasta`
  const latidos = (hasta: number) =>
    Array.from({ length: hasta * 2 + 1 }, (_, i) => en(i / 2, NODO.latido, i))

  // El gemelo después de la primera lectura: la celda en marcha, en reposo.
  function enMarcha(valores: Record<string, number> = {}) {
    const gemelo = crearGemelo('vivo')
    sembrarValores(
      gemelo,
      {
        [NODO.torreta]: 1,
        [NODO.marcha]: 1,
        [NODO.latido]: 0,
        [NODO.paso]: 0,
        [NODO.aluminio]: 10,
        [NODO.otras]: 20,
        ...valores,
      },
      T0 - 1000,
    )
    return gemelo
  }

  // Un ciclo real con sus salidas, como llega de /lecturas/cambios.
  const ciclo = (conSello = true) => [
    en(0, NODO.paso, 2),
    en(0, NODO.empujaExt, 1),
    en(1, NODO.empujaExt, 0),
    en(1, NODO.paso, 3),
    en(1, NODO.empujaRet, 1),
    en(2, NODO.empujaRet, 0),
    en(2, NODO.paso, 4),
    en(3, NODO.otras, 21),
    en(5, NODO.paso, 5),
    en(5, NODO.aprieta, 1),
    en(6, NODO.aprieta, 0),
    en(6, NODO.paso, 7),
    ...(conSello ? [en(6, NODO.sello, 1), en(6.6, NODO.sello, 0)] : []),
    en(7, NODO.paso, 8),
    en(7, NODO.suelta, 1),
    en(7.6, NODO.suelta, 0),
    en(8, NODO.paso, 9),
    en(9.5, NODO.paso, 0),
  ]

  it('sin datos dice SIN DATO', () => {
    const gemelo = crearGemelo('vivo')
    correr(gemelo, 1)
    expect(gemelo.senales.estado).toBe('sinDato')
    expect(gemelo.senales.torreVerde || gemelo.senales.torreRoja).toBe(false)
  })

  it('si LATIDO nunca cambia (no se guarda), no se marca sin comunicación', () => {
    const gemelo = enMarcha()
    recibirCambiosReales(gemelo, [en(0, NODO.paso, 2)])
    correr(gemelo, 30)
    expect(gemelo.senales.vigilaLatido).toBe(false)
    expect(gemelo.senales.estado).toBe('marcha')
  })

  it('si el panel deja de responder: SIN COMUNICACIÓN aunque no haya latido', () => {
    const gemelo = enMarcha()
    correr(gemelo, 0.5)
    ponerEnlace(gemelo, false)
    correr(gemelo, 0.1)
    expect(gemelo.senales.estado).toBe('sinComunicacion')
    ponerEnlace(gemelo, true)
    correr(gemelo, 0.1)
    expect(gemelo.senales.estado).toBe('marcha')
  })

  it('el reloj de la repetición va con el tiempo real aunque los cuadros sean lentos', () => {
    const gemelo = enMarcha()
    recibirCambiosReales(gemelo, [en(0, NODO.empujaExt, 1), ...latidos(10)])
    // cuadros de medio segundo (2 cuadros por segundo)
    for (let i = 0; i < 9; i++) avanzarGemelo(gemelo, 0.5)
    expect(gemelo.senales.yA).toBe(true)
  })

  it('un lote que llega tarde se recorre en lugar de aplicarse de golpe', () => {
    const gemelo = enMarcha()
    recibirCambiosReales(gemelo, [en(0, NODO.paso, 2), ...latidos(1)])
    correr(gemelo, 8)
    // llega 10 s después: ya debió mostrarse, pero se ve en orden
    recibirCambiosReales(gemelo, [en(2, NODO.paso, 3), en(3, NODO.paso, 4)])
    const pasos = anotar(gemelo, 3, () => gemelo.senales.pasoReal)
    expect(pasos).toEqual([2, 3, 4])
  })

  it('arranca con la última lectura: torreta y letrero salen de TAB_TORRETA', () => {
    const gemelo = enMarcha({ [NODO.torreta]: 2, [NODO.marcha]: 0 })
    correr(gemelo, 0.2)
    expect(gemelo.senales.estado).toBe('mantenimiento')
    expect(gemelo.senales.torreAmarilla).toBe(true)
  })

  it('cualquier otro valor de la torreta: todas apagadas y SIN DATO', () => {
    const gemelo = enMarcha({ [NODO.torreta]: 7 })
    correr(gemelo, 0.2)
    expect(gemelo.senales.estado).toBe('sinDato')
    const { torreVerde, torreAmarilla, torreRoja } = gemelo.senales
    expect(torreVerde || torreAmarilla || torreRoja).toBe(false)
  })

  it('repite las salidas en orden: PD-1 empuja, PD-2 aprieta, el sello marca y la pieza baja al depósito', () => {
    const gemelo = enMarcha()
    recibirCambiosReales(gemelo, [...ciclo(), ...latidos(16)])
    const pasos = anotar(gemelo, 16, () => gemelo.senales.pasoReal)
    expect(pasos).toEqual([0, 2, 3, 4, 5, 7, 8, 9, 0])
    const pieza = gemelo.planta.ultimaSacada
    expect(pieza?.tipo).toBe('pl') // TAB_OTRAS subió
    expect(pieza?.marcada).toBe(true)
    expect(pieza?.sello).toBe('pl') // paso 7
    expect(gemelo.senales.estado).toBe('marcha')
    correrHasta(gemelo, () => piezas(gemelo) === 1, 20)
    expect(gemelo.senales.piezasPl).toBe(1)
  })

  it('va unos segundos detrás de la celda, con la misma distancia entre cambios', () => {
    const gemelo = enMarcha()
    recibirCambiosReales(gemelo, [en(0, NODO.empujaExt, 1), ...latidos(10)])
    correr(gemelo, 3.5)
    expect(gemelo.senales.yA).toBe(false)
    correr(gemelo, 1)
    expect(gemelo.senales.yA).toBe(true)
  })

  it('si el pulso del sello no quedó en el historian, el paso 7 marca igual', () => {
    const gemelo = enMarcha()
    recibirCambiosReales(gemelo, [...ciclo(false), ...latidos(16)])
    correr(gemelo, 16)
    expect(gemelo.planta.ultimaSacada?.sello).toBe('pl')
  })

  it('los de doble efecto se quedan donde están cuando ninguna salida está activa', () => {
    const gemelo = enMarcha()
    recibirCambiosReales(gemelo, [
      en(0, NODO.empujaExt, 1),
      en(0.6, NODO.empujaExt, 0),
      en(0, NODO.aprieta, 1),
      en(0.6, NODO.aprieta, 0),
      ...latidos(10),
    ])
    correr(gemelo, 8)
    expect(gemelo.planta.extension.A).toBeGreaterThan(0.98)
    expect(gemelo.planta.extension.B).toBeGreaterThan(0.98)
  })

  it('reset real: amarillo parpadeando mientras RET y SUELTA regresan los pistones, luego paro', () => {
    const gemelo = enMarcha()
    recibirCambiosReales(gemelo, [
      en(0, NODO.empujaExt, 1),
      en(0.6, NODO.empujaExt, 0),
      en(1, NODO.torreta, 4),
      en(1, NODO.marcha, 0),
      en(1, NODO.empujaRet, 1),
      en(1, NODO.suelta, 1),
      en(4, NODO.torreta, 3),
      en(4, NODO.empujaRet, 0),
      en(4, NODO.suelta, 0),
      ...latidos(15),
    ])
    correr(gemelo, 5.5)
    expect(gemelo.senales.estado).toBe('reset')
    const amarilla = anotar(gemelo, 2, () => gemelo.senales.torreAmarilla)
    expect(amarilla).toContain(true)
    expect(amarilla).toContain(false)
    correr(gemelo, 2)
    expect(gemelo.senales.estado).toBe('paro')
    expect(gemelo.senales.torreRoja).toBe(true)
    expect(gemelo.planta.extension.A).toBeLessThan(0.02)
  })

  it('falla: letrero FALLA con TAB_COD_FALLA', () => {
    const gemelo = enMarcha()
    recibirCambiosReales(gemelo, [
      en(0, NODO.torreta, 3),
      en(0, NODO.marcha, 0),
      en(0, NODO.falla, 1),
      en(0, NODO.codFalla, 12),
      ...latidos(10),
    ])
    correr(gemelo, 4.5)
    expect(gemelo.senales.estado).toBe('falla')
    expect(gemelo.senales.codFalla).toBe(12)
    expect(gemelo.senales.torreRoja).toBe(true)
  })

  it('si LATIDO no cambia en más de 5 s: SIN COMUNICACIÓN y torreta gris', () => {
    const gemelo = enMarcha()
    recibirCambiosReales(gemelo, latidos(3))
    correr(gemelo, 11)
    expect(gemelo.senales.estado).toBe('marcha')
    correr(gemelo, 1.5)
    expect(gemelo.senales.estado).toBe('sinComunicacion')
    expect(gemelo.senales.torreGris).toBe(true)
  })

  it('si el contador llega después de que la pieza salió, la pieza gris toma su material', () => {
    const gemelo = enMarcha()
    recibirCambiosReales(gemelo, [
      ...ciclo().filter((c) => c.nodo !== NODO.otras),
      ...latidos(16),
    ])
    correr(gemelo, 8)
    const pieza = gemelo.planta.ultimaSacada
    expect(pieza?.conocida).toBe(false)
    meterPiezas(gemelo, ['al'])
    expect(pieza?.conocida).toBe(true)
    expect(pieza?.tipo).toBe('al')
    expect(gemelo.porEntrar).toEqual([])
  })

  it('en el almacén solo tienen color las piezas ya contadas; las demás son grises', () => {
    const gemelo = enMarcha()
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

  it('no acumula más de las últimas seis piezas contadas', () => {
    const gemelo = enMarcha()
    meterPiezas(gemelo, Array(10).fill('pl'))
    expect(gemelo.porEntrar).toHaveLength(6)
  })

  it('en simulación no se usan los datos reales', () => {
    const gemelo = crearGemelo('simulacion')
    sembrarValores(gemelo, { [NODO.torreta]: 3 }, T0)
    recibirCambiosReales(gemelo, [en(0, NODO.paso, 2)])
    meterPiezas(gemelo, ['al'])
    expect(gemelo.repeticion.sembrada).toBe(false)
    expect(gemelo.repeticion.eventos).toEqual([])
    expect(gemelo.porEntrar).toEqual([])
  })

  it('al cambiar de modo empieza limpio', () => {
    const gemelo = crearGemelo('simulacion')
    correr(gemelo, 6)
    ponerModo(gemelo, 'vivo')
    expect(gemelo.valores).toEqual({})
    expect(gemelo.plc.garra.estado).toBe('REPOSO')
    expect(
      gemelo.planta.piezas.every(
        (p) =>
          p.estado === 'almacen' || p.estado === 'caja' || p.estado === 'cae',
      ),
    ).toBe(true)
    correr(gemelo, 1)
    expect(gemelo.senales.estado).toBe('sinDato')
  })
})
