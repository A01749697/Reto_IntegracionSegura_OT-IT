import { describe, expect, it } from 'vitest'
import { seguridad } from '../configuracion/seguridad'
import { validarConsultaBitacora } from './bitacora.esquema'

describe('validarConsultaBitacora', () => {
  it('sin nada usa los valores por defecto', () => {
    expect(validarConsultaBitacora({})).toEqual({
      ok: true,
      datos: {
        grupo: 'todos',
        antes: null,
        limite: seguridad.bitacora.porDefecto,
      },
    })
  })

  it('acepta los tres filtros', () => {
    expect(
      validarConsultaBitacora({ grupo: 'alertas', antes: '30', limite: '10' }),
    ).toEqual({ ok: true, datos: { grupo: 'alertas', antes: 30, limite: 10 } })
  })

  it.each([
    [{ grupo: 'otro' }],
    [{ antes: '0' }],
    [{ antes: '-1' }],
    [{ antes: '01' }],
    [{ antes: 'abc' }],
    [{ limite: '0' }],
    [{ limite: '1.5' }],
    [{ limite: String(seguridad.bitacora.maximo + 1) }],
    [{ grupo: ['todos', 'alertas'] }],
    [{ antes: ['1', '2'] }],
    [{ tipo: 'entrada_fallida' }],
  ])('rechaza %j', (consulta) => {
    expect(validarConsultaBitacora(consulta).ok).toBe(false)
  })

  it('rechaza lo que no es un objeto', () => {
    expect(validarConsultaBitacora(null).ok).toBe(false)
    expect(validarConsultaBitacora('grupo=todos').ok).toBe(false)
  })
})
