import { describe, expect, it } from 'vitest'
import { NODO } from './nodos'
import {
  avanzarPlc1516,
  crearPlc1516,
  FALLAS,
  mandar,
  SEGUNDOS_RESET,
  type Entradas,
} from './s7_1516'

// La planta más sencilla: cada final de carrera sigue a su salida al instante.
function planta(): Entradas {
  return {
    ls1: true,
    ls2: false,
    ls3: false,
    b0: true,
    c1: false,
    sc1: false,
    si1: false,
    sc2: false,
    ls4: false,
  }
}

function correr(
  plc: ReturnType<typeof crearPlc1516>,
  e: Entradas,
  segundos: number,
  mover = true,
) {
  for (let t = 0; t < segundos; t += 1 / 120) {
    avanzarPlc1516(plc, e, 1 / 120)
    if (!mover) continue
    const o = plc.salidas
    if (o.ext) [e.ls1, e.ls2] = [false, true]
    if (o.ret) [e.ls1, e.ls2] = [true, false]
    if (o.aprieta) [e.ls3, e.b0] = [true, false]
    if (o.suelta) [e.ls3, e.b0] = [false, true]
    e.c1 = o.sello
    // la pieza llega a la estación al regresar el empujador y se va en el paso 9
    if (plc.paso === 4) e.sc2 = true
    if (plc.paso === 9) e.sc2 = false
  }
}

const v = (plc: ReturnType<typeof crearPlc1516>, nodo: string) =>
  plc.valores[nodo]

describe('S7-1516 virtual', () => {
  it('sin marcha está en paro (torreta 3) y el latido sube', () => {
    const plc = crearPlc1516()
    correr(plc, planta(), 1)
    expect(v(plc, NODO.torreta)).toBe(3)
    expect(v(plc, NODO.paso)).toBe(0)
    expect(v(plc, NODO.latido)).toBeGreaterThan(3)
  })

  it('con marcha hace un ciclo completo y lo cuenta', () => {
    const plc = crearPlc1516()
    mandar(plc, 'marcha')
    const e = planta()
    correr(plc, e, 0.1)
    expect(v(plc, NODO.torreta)).toBe(1)
    correr(plc, e, 6)
    expect(v(plc, NODO.ciclos)).toBeGreaterThanOrEqual(1)
    expect(v(plc, NODO.otras)).toBeGreaterThanOrEqual(1) // sin metal: plástico
    expect(v(plc, NODO.tCiclo)).toBeGreaterThan(0)
  })

  it('el paro deja la secuencia donde iba', () => {
    const plc = crearPlc1516()
    mandar(plc, 'marcha')
    const e = planta()
    correr(plc, e, 0.4)
    mandar(plc, 'paro')
    const paso = plc.paso
    correr(plc, e, 3)
    expect(plc.paso).toBe(paso)
    expect(v(plc, NODO.marcha)).toBe(0)
    expect(v(plc, NODO.torreta)).toBe(3)
  })

  it('mantenimiento: torreta 2 y no deja arrancar', () => {
    const plc = crearPlc1516()
    mandar(plc, 'mantenimiento')
    mandar(plc, 'marcha')
    correr(plc, planta(), 0.1)
    expect(v(plc, NODO.torreta)).toBe(2)
    expect(v(plc, NODO.marcha)).toBe(0)
  })

  it('reset: torreta 4 con RET y SUELTA durante 3 s, luego 3', () => {
    const plc = crearPlc1516()
    mandar(plc, 'marcha')
    const e = planta()
    correr(plc, e, 1)
    mandar(plc, 'reset')
    correr(plc, e, 0.1)
    expect(v(plc, NODO.torreta)).toBe(4)
    expect(v(plc, NODO.paso)).toBe(0)
    expect(v(plc, NODO.empujaRet)).toBe(1)
    expect(v(plc, NODO.suelta)).toBe(1)
    correr(plc, e, SEGUNDOS_RESET)
    expect(v(plc, NODO.torreta)).toBe(3)
    expect(v(plc, NODO.empujaRet)).toBe(0)
  })

  it('si un final de carrera no llega a tiempo, falla con el código del paso', () => {
    const plc = crearPlc1516()
    mandar(plc, 'marcha')
    correr(plc, planta(), 5, false) // nada se mueve: PD-1 no llega
    expect(v(plc, NODO.falla)).toBe(1)
    expect(v(plc, NODO.codFalla)).toBe(FALLAS.empujador)
    expect(v(plc, NODO.torreta)).toBe(3)
    mandar(plc, 'marcha')
    expect(plc.marcha).toBe(false)
    mandar(plc, 'reset')
    expect(plc.falla).toBe(false)
    expect(plc.codFalla).toBe(0)
  })
})
