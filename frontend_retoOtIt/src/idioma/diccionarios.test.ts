import { describe, expect, it } from 'vitest'
import { en } from './en'
import { es } from './es'

// "a.b.c" para cada frase del diccionario
function claves(objeto: object, prefijo = ''): string[] {
  return Object.entries(objeto).flatMap(([clave, valor]) =>
    typeof valor === 'string'
      ? [`${prefijo}${clave}`]
      : claves(valor as object, `${prefijo}${clave}.`),
  )
}

function textoDe(objeto: object, ruta: string): string {
  let actual: unknown = objeto
  for (const parte of ruta.split('.')) {
    actual = (actual as Record<string, unknown>)[parte]
  }
  return actual as string
}

const marcas = (texto: string) => (texto.match(/\{\{\w+\}\}/g) ?? []).sort()

describe('diccionarios', () => {
  it('español e inglés tienen exactamente las mismas frases', () => {
    expect(claves(en)).toEqual(claves(es))
  })

  it('ninguna frase está vacía', () => {
    for (const clave of claves(es)) {
      expect(textoDe(es, clave).trim(), `es.${clave}`).not.toBe('')
      expect(textoDe(en, clave).trim(), `en.${clave}`).not.toBe('')
    }
  })

  it('las variables como {{minimo}} son las mismas en los dos idiomas', () => {
    for (const clave of claves(es)) {
      expect(marcas(textoDe(en, clave)), clave).toEqual(
        marcas(textoDe(es, clave)),
      )
    }
  })

  it('el inglés no se quedó con las frases en español', () => {
    const iguales = claves(es).filter(
      (clave) => textoDe(es, clave) === textoDe(en, clave),
    )
    // nombres propios y siglas que no cambian
    const permitidas = new Set([
      'camino.zonas.ot.nombre',
      'camino.zonas.idmz.nombre',
      'camino.zonas.it.nombre',
      'idioma.es',
      'idioma.en',
      'estado.tabla.plc',
      'estado.tabla.variable',
      'bitacora.columnas.ip',
      'datos.no',
    ])
    expect(iguales.filter((clave) => !permitidas.has(clave))).toEqual([])
  })
})
