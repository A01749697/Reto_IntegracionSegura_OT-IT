import { describe, expect, it } from 'vitest'
import { diasRestantes, interpretarMeminfo, redondear } from './recursos'

const MEMINFO = `MemTotal:        2035556 kB
MemFree:          100000 kB
MemAvailable:     900000 kB
Buffers:           50000 kB
SwapTotal:       1048572 kB
SwapFree:         948572 kB
HugePages_Total:       0
`

describe('interpretarMeminfo', () => {
  it('convierte kilobytes a bytes y calcula la swap usada', () => {
    expect(interpretarMeminfo(MEMINFO)).toEqual({
      totalBytes: 2035556 * 1024,
      disponibleBytes: 900000 * 1024,
      swapTotalBytes: 1048572 * 1024,
      swapUsadoBytes: 100000 * 1024,
    })
  })

  it('acepta un servidor sin swap', () => {
    const texto = MEMINFO.replace('1048572', '0').replace('948572', '0')
    expect(interpretarMeminfo(texto)?.swapUsadoBytes).toBe(0)
  })

  it('regresa null si falta una línea necesaria', () => {
    expect(
      interpretarMeminfo(MEMINFO.replace('MemAvailable', 'Otra')),
    ).toBeNull()
    expect(interpretarMeminfo('')).toBeNull()
  })

  it('regresa null si los números no cuadran', () => {
    const disponibleMayor = MEMINFO.replace('900000 kB', '9999999 kB')
    expect(interpretarMeminfo(disponibleMayor)).toBeNull()
    const swapLibreMayor = MEMINFO.replace('948572', '9999999')
    expect(interpretarMeminfo(swapLibreMayor)).toBeNull()
  })
})

describe('diasRestantes', () => {
  const ahora = new Date('2026-11-22T12:00:00Z').getTime()

  it('cuenta días completos', () => {
    expect(diasRestantes(new Date('2026-12-18T12:00:00Z'), ahora)).toBe(26)
    expect(diasRestantes(new Date('2026-12-18T11:59:00Z'), ahora)).toBe(25)
  })

  it('si ya venció sale negativo', () => {
    expect(diasRestantes(new Date('2026-11-20T12:00:00Z'), ahora)).toBe(-2)
  })
})

describe('redondear', () => {
  it('redondea a dos decimales por defecto', () => {
    expect(redondear(0.456)).toBe(0.46)
    expect(redondear(1.2, 1)).toBe(1.2)
  })
})
