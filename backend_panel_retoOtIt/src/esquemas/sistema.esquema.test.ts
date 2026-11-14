import { describe, expect, it } from 'vitest'
import { validarConsultaDisponibilidad } from './sistema.esquema'

describe('validarConsultaDisponibilidad', () => {
  it.each(['24h', '7d'])('acepta la ventana %s', (ventana) => {
    expect(validarConsultaDisponibilidad({ ventana })).toEqual({
      ok: true,
      ventana,
    })
  })

  it.each([
    [undefined],
    [null],
    ['24h'],
    [['24h']],
    [{}],
    [{ ventana: '30d' }],
    [{ ventana: '' }],
    [{ ventana: ['24h'] }],
    [{ ventana: 24 }],
    [{ ventana: '24h', extra: 'x' }],
    [{ otra: '24h' }],
  ])('rechaza %j', (consulta) => {
    expect(validarConsultaDisponibilidad(consulta).ok).toBe(false)
  })
})
