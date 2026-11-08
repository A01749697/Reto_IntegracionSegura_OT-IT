import { describe, expect, it, vi } from 'vitest'
import { CATALOGO } from '../repositorios/datos.repositorio'
import { crearServicioDatos } from './datos.servicio'

const QUIEN = { usuarioId: 1, correo: 'admin@ejemplo.com', ip: '203.0.113.9' }

function fila(id: number) {
  return { id, nombre: `Cuenta ${id}` }
}

function preparar(filas: ReturnType<typeof fila>[] = []) {
  const dependencias = {
    leerTabla: vi.fn().mockResolvedValue(filas),
    registrarEvento: vi.fn().mockResolvedValue(undefined),
  }
  return { dependencias, servicio: crearServicioDatos(dependencias) }
}

describe('servicio de Datos', () => {
  it('el catálogo lista las dos tablas con sus columnas', () => {
    const { servicio } = preparar()
    expect(servicio.catalogo()).toEqual([
      { id: 'cuentas', nombre: 'Cuentas', columnas: CATALOGO.cuentas.columnas },
      {
        id: 'bitacora',
        nombre: 'Bitácora',
        columnas: CATALOGO.bitacora.columnas,
      },
    ])
  })

  it('pide una fila de más para saber si quedan, y no la devuelve', async () => {
    const { dependencias, servicio } = preparar([fila(5), fila(4), fila(3)])

    const pagina = await servicio.consultar(
      'cuentas',
      { buscar: 'ana', antes: null, limite: 2 },
      QUIEN,
    )

    expect(dependencias.leerTabla).toHaveBeenCalledWith('cuentas', {
      buscar: 'ana',
      antes: null,
      limite: 3,
    })
    expect(pagina.filas).toEqual([fila(5), fila(4)])
    expect(pagina.hayMas).toBe(true)
    expect(pagina.columnas).toBe(CATALOGO.cuentas.columnas)
  })

  it('si no sobran filas, no hay más', async () => {
    const { servicio } = preparar([fila(2), fila(1)])
    const pagina = await servicio.consultar(
      'bitacora',
      { buscar: null, antes: null, limite: 2 },
      QUIEN,
    )
    expect(pagina.hayMas).toBe(false)
    expect(pagina.filas).toHaveLength(2)
  })

  it('la primera página de cuentas queda anotada en la bitácora', async () => {
    const { dependencias, servicio } = preparar()
    await servicio.consultar(
      'cuentas',
      { buscar: null, antes: null, limite: 50 },
      QUIEN,
    )
    expect(dependencias.registrarEvento).toHaveBeenCalledWith({
      tipo: 'datos_cuentas_consultadas',
      usuarioId: 1,
      correo: 'admin@ejemplo.com',
      ip: '203.0.113.9',
    })
  })

  it('la primera página de bitácora anota su propio tipo', async () => {
    const { dependencias, servicio } = preparar()
    await servicio.consultar(
      'bitacora',
      { buscar: null, antes: null, limite: 50 },
      QUIEN,
    )
    expect(dependencias.registrarEvento).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'datos_bitacora_consultada' }),
    )
  })

  it('"ver más" no vuelve a anotar', async () => {
    const { dependencias, servicio } = preparar()
    await servicio.consultar(
      'cuentas',
      { buscar: null, antes: 40, limite: 50 },
      QUIEN,
    )
    expect(dependencias.registrarEvento).not.toHaveBeenCalled()
  })

  it('si la lectura falla, no anota nada y el error sube', async () => {
    const { dependencias, servicio } = preparar()
    dependencias.leerTabla.mockRejectedValue(new Error('caída'))
    await expect(
      servicio.consultar(
        'cuentas',
        { buscar: null, antes: null, limite: 50 },
        QUIEN,
      ),
    ).rejects.toThrow('caída')
    expect(dependencias.registrarEvento).not.toHaveBeenCalled()
  })
})
