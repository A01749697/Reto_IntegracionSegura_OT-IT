import { afterEach, describe, expect, it, vi } from 'vitest'
import { seguridad } from '../configuracion/seguridad'
import type { EstadoVariable } from '../repositorios/lecturas.repositorio'
import { crearServicioSistema } from './sistema.servicio'

function variable(
  segundos: number,
  nombre = 'contador_piezas',
): EstadoVariable {
  return {
    plc: 'S7-1500',
    variable: nombre,
    ts: new Date('2026-11-06T18:00:00Z'),
    segundosDesdeRecibida: segundos,
  }
}

function crearDependenciasFalsas(variables: EstadoVariable[] = []) {
  return {
    comprobarBasePanel: vi.fn().mockResolvedValue(undefined),
    obtenerEstadoLecturas: vi.fn().mockResolvedValue(variables),
    obtenerActividadLecturas: vi.fn().mockResolvedValue({
      ahora: new Date('2026-11-12T12:07:00.000Z'),
      primera: new Date('2026-11-01T00:00:00.000Z'),
      cubetas: [],
    }),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('servicio de sistema', () => {
  it('todo bien y con lecturas recientes: datos al día', async () => {
    const servicio = crearServicioSistema(
      crearDependenciasFalsas([variable(20)]),
    )

    expect(await servicio.estado()).toEqual({
      api: 'ok',
      baseDatosPanel: 'ok',
      baseDatosLecturas: 'ok',
      datos: 'al_dia',
      variables: [variable(20)],
    })
  })

  it('sin ninguna lectura: sin datos', async () => {
    const servicio = crearServicioSistema(crearDependenciasFalsas([]))
    expect((await servicio.estado()).datos).toBe('sin_datos')
  })

  it('usa la variable más reciente para decidir si está al día', async () => {
    const pasado = seguridad.sistema.lecturaRetrasadaSegundos + 1
    const servicio = crearServicioSistema(
      crearDependenciasFalsas([variable(pasado), variable(5, 'velocidad')]),
    )
    expect((await servicio.estado()).datos).toBe('al_dia')
  })

  it('si todas pasaron del tiempo permitido: retrasado', async () => {
    const pasado = seguridad.sistema.lecturaRetrasadaSegundos + 1
    const servicio = crearServicioSistema(
      crearDependenciasFalsas([variable(pasado)]),
    )
    expect((await servicio.estado()).datos).toBe('retrasado')
  })

  it('si falla la base del panel lo dice y lo demás sigue', async () => {
    const dependencias = crearDependenciasFalsas([variable(20)])
    dependencias.comprobarBasePanel.mockRejectedValue(new Error('caida'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const servicio = crearServicioSistema(dependencias)

    const estado = await servicio.estado()

    expect(estado.baseDatosPanel).toBe('falla')
    expect(estado.baseDatosLecturas).toBe('ok')
    expect(estado.datos).toBe('al_dia')
  })

  it('si falla la base de lecturas no inventa datos', async () => {
    const dependencias = crearDependenciasFalsas()
    dependencias.obtenerEstadoLecturas.mockRejectedValue(new Error('caida'))
    const aviso = vi.spyOn(console, 'error').mockImplementation(() => {})
    const servicio = crearServicioSistema(dependencias)

    const estado = await servicio.estado()

    expect(estado).toMatchObject({
      baseDatosLecturas: 'falla',
      datos: 'desconocido',
      variables: [],
    })
    expect(aviso).toHaveBeenCalledWith(
      'Falla al comprobar la base de lecturas:',
      'caida',
    )
  })
})

describe('servicio de sistema, disponibilidad', () => {
  it('con una ventana válida pide a la base el tamaño y la cantidad de cubetas', async () => {
    const dependencias = crearDependenciasFalsas()
    const servicio = crearServicioSistema(dependencias)

    const resultado = await servicio.disponibilidad({ ventana: '7d' })

    expect(dependencias.obtenerActividadLecturas).toHaveBeenCalledWith(
      seguridad.sistema.disponibilidad['7d'].cubetaSegundos,
      seguridad.sistema.disponibilidad['7d'].cantidad,
    )
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      expect(resultado.disponibilidad.ventana).toBe('7d')
      expect(resultado.disponibilidad.cubetas).toHaveLength(
        seguridad.sistema.disponibilidad['7d'].cantidad,
      )
    }
  })

  it('una ventana inválida se rechaza sin consultar la base', async () => {
    const dependencias = crearDependenciasFalsas()
    const servicio = crearServicioSistema(dependencias)

    const resultado = await servicio.disponibilidad({ ventana: '30d' })

    expect(resultado).toEqual({ ok: false, error: 'ventana debe ser 24h o 7d' })
    expect(dependencias.obtenerActividadLecturas).not.toHaveBeenCalled()
  })

  it('si la base falla el error sube y no se inventa un historial', async () => {
    const dependencias = crearDependenciasFalsas()
    dependencias.obtenerActividadLecturas.mockRejectedValue(new Error('caida'))
    const servicio = crearServicioSistema(dependencias)

    await expect(servicio.disponibilidad({ ventana: '24h' })).rejects.toThrow(
      'caida',
    )
  })
})
