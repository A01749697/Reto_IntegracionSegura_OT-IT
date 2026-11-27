import { describe, expect, it } from 'vitest'
import { avanzarActuadores, crearActuadores } from './actuadores'
import { NODO } from './nodos'
import { senalesIniciales } from './senales'

function preparar() {
  return { a: crearActuadores(), s: senalesIniciales() }
}

describe('avanzarActuadores', () => {
  it('PD-1 sale con EXT, entra con RET y se queda donde está sin ninguna', () => {
    const { a, s } = preparar()
    avanzarActuadores(a, { [NODO.empujaExt]: 1 }, s, false, 0.01)
    expect(s.yA).toBe(true)
    avanzarActuadores(a, {}, s, false, 0.01)
    expect(s.yA).toBe(true)
    avanzarActuadores(a, { [NODO.empujaRet]: 1 }, s, false, 0.01)
    expect(s.yA).toBe(false)
  })

  it('PD-2 cierra con APRIETA y abre con SUELTA', () => {
    const { a, s } = preparar()
    avanzarActuadores(a, { [NODO.aprieta]: 1 }, s, false, 0.01)
    expect(s.yB).toBe(true)
    avanzarActuadores(a, { [NODO.aprieta]: 0 }, s, false, 0.01)
    expect(s.yB).toBe(true)
    avanzarActuadores(a, { [NODO.suelta]: 1 }, s, false, 0.01)
    expect(s.yB).toBe(false)
  })

  it('el sello baja con su salida y se queda al menos un momento abajo', () => {
    const { a, s } = preparar()
    avanzarActuadores(a, { [NODO.sello]: 1 }, s, false, 0.01)
    expect(s.yC).toBe(true)
    avanzarActuadores(a, { [NODO.sello]: 0 }, s, false, 0.1)
    expect(s.yC).toBe(true)
    avanzarActuadores(a, { [NODO.sello]: 0 }, s, false, 0.5)
    expect(s.yC).toBe(false)
  })

  it('el paso de sello dice el material y baja el sello aunque no llegue la salida', () => {
    const { a, s } = preparar()
    avanzarActuadores(a, { [NODO.paso]: 6 }, s, false, 0.01)
    expect(s.material).toBe('al')
    expect(s.yC).toBe(true)
    avanzarActuadores(a, { [NODO.paso]: 2 }, s, false, 0.01)
    expect(s.material).toBe('')
  })

  it('el tope abre con la pieza sellada y PD-2 abierto, y solo si el depósito está libre', () => {
    const { a, s } = preparar()
    s.ls4 = true
    avanzarActuadores(a, {}, s, true, 0.01)
    expect(s.yT).toBe(false)
    s.ls4 = false
    avanzarActuadores(a, {}, s, true, 0.01)
    expect(s.yT).toBe(true)
  })

  it('TAB_MARCHA y TAB_PASO pasan a las señales', () => {
    const { a, s } = preparar()
    avanzarActuadores(a, { [NODO.marcha]: 1, [NODO.paso]: 8 }, s, false, 0.01)
    expect(s.marcha).toBe(true)
    expect(s.pasoReal).toBe(8)
    expect(s.paso).toBe(4)
  })
})
