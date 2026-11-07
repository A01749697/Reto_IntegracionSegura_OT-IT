import { describe, expect, it } from 'vitest'
import { aCsv } from './csv'

const MARCA = String.fromCharCode(0xfeff)

describe('aCsv', () => {
  it('arma encabezados y filas con saltos de línea de Windows', () => {
    expect(aCsv(['a', 'b'], [[1, 'x']])).toBe(`${MARCA}a,b\r\n1,x\r\n`)
  })

  it('deja vacías las celdas nulas', () => {
    expect(aCsv(['a', 'b'], [[null, 'x']])).toBe(`${MARCA}a,b\r\n,x\r\n`)
  })

  it('entrecomilla comas, comillas y saltos de línea', () => {
    expect(aCsv(['a'], [['uno, dos'], ['dice "hola"'], ['a\nb']])).toBe(
      `${MARCA}a\r\n"uno, dos"\r\n"dice ""hola"""\r\n"a\nb"\r\n`,
    )
  })

  it.each(['=1+1', '+1', '-1', '@suma', '\tx'])(
    'neutraliza una celda que Excel tomaría como fórmula: %j',
    (texto) => {
      const filas = aCsv(['a'], [[texto]]).split('\r\n')
      expect(filas[1]).toBe(`'${texto}`)
    },
  )

  it('empieza con la marca UTF-8 para que Excel lea bien los acentos', () => {
    expect(aCsv(['correo'], []).startsWith(MARCA)).toBe(true)
  })
})
