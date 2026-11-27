import { describe, expect, it } from 'vitest'
import {
  avanzarSeguidor,
  crearSeguidor,
  DURACION_MINIMA,
  siguientePaso,
} from './seguidor'
import { senalesIniciales } from './senales'

describe('siguientePaso', () => {
  it('sigue la secuencia del S7-1516', () => {
    expect(siguientePaso(0, 9, null)).toBe(1)
    expect(siguientePaso(2, 9, null)).toBe(3)
    expect(siguientePaso(4, 9, null)).toBe(5)
    expect(siguientePaso(6, 9, null)).toBe(8)
    expect(siguientePaso(7, 9, null)).toBe(8)
    expect(siguientePaso(9, 2, null)).toBe(0)
  })

  it('después de apretar va al sello del material', () => {
    expect(siguientePaso(5, 7, 'al')).toBe(7) // el paso real manda
    expect(siguientePaso(5, 8, 'al')).toBe(6)
    expect(siguientePaso(5, 8, 'pl')).toBe(7)
    expect(siguientePaso(5, 8, null)).toBe(8) // sin material, sin sello
  })

  it('un paro a media secuencia va directo al reposo', () => {
    expect(siguientePaso(5, 0, 'al')).toBe(0)
    expect(siguientePaso(3, 1, null)).toBe(1)
  })
})

describe('avanzarSeguidor', () => {
  const correr = (
    pasos: number[],
    objetivo: number,
    segundos: number,
    s = senalesIniciales(),
  ) => {
    const seg = crearSeguidor()
    seg.paso = pasos[0]
    for (let t = 0; t < segundos; t += 0.01)
      avanzarSeguidor(seg, objetivo, s, null, 0.01)
    return { seg, s }
  }

  it('cada paso prende los pistones que le tocan', () => {
    const casos: [number, Partial<Record<'yA' | 'yB' | 'yC', boolean>>][] = [
      [2, { yA: true, yB: false, yC: false }],
      [3, { yA: false, yB: false, yC: false }],
      [5, { yA: false, yB: true, yC: false }],
      [6, { yB: true, yC: true }],
      [8, { yB: false, yC: false }],
    ]
    for (const [paso, salidas] of casos) {
      const { s } = correr([paso], paso, 0.05)
      expect(s).toMatchObject(salidas)
    }
  })

  it('en el paso 4 el pistón de apriete sale y regresa', () => {
    const s = senalesIniciales()
    const seg = crearSeguidor()
    seg.paso = 4
    avanzarSeguidor(seg, 4, s, null, 0.01)
    expect(s.yB).toBe(true)
    for (let t = 0; t < 1; t += 0.01) avanzarSeguidor(seg, 4, s, null, 0.01)
    expect(s.yB).toBe(false)
  })

  it('el paso de sello deja el material del sello para el marcador', () => {
    expect(correr([7], 7, 0.05).s.material).toBe('pl')
    expect(correr([6], 6, 0.05).s.material).toBe('al')
  })

  it('al alcanzar al real, cada paso dura al menos un momento', () => {
    const { seg } = correr([2], 5, DURACION_MINIMA * 2.5)
    expect(seg.paso).toBe(4)
  })

  it('el paso del gemelo sale del paso real', () => {
    expect(correr([2], 2, 0.05).s.paso).toBe(1)
    expect(correr([4], 4, 0.05).s.paso).toBe(2)
    expect(correr([7], 7, 0.05).s.paso).toBe(3)
    expect(correr([9], 9, 0.05).s.paso).toBe(4)
    expect(correr([0], 0, 0.05).s.paso).toBe(0)
  })

  it('ignora valores que no son de la secuencia', () => {
    const { seg } = correr([3], 42, 2)
    expect(seg.paso).toBe(3)
  })
})
