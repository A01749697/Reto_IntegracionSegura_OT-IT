import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  TIPOS_ALERTA,
  type EventoBitacora,
} from '../repositorios/bitacora.repositorio'
import { crearServicioBitacora } from './bitacora.servicio'

function crearEvento(id: number): EventoBitacora {
  return {
    id,
    ocurrioEn: new Date('2026-11-06T18:00:00Z'),
    tipo: 'entrada_fallida',
    usuarioId: null,
    correo: 'ana@ejemplo.com',
    ip: '203.0.113.7',
    actorCorreo: null,
  }
}

function crearDependenciasFalsas() {
  return {
    insertarEvento: vi.fn().mockResolvedValue(undefined),
    listarEventos: vi.fn().mockResolvedValue([]),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('servicio de bitácora', () => {
  describe('registrar', () => {
    it('guarda el evento tal cual', async () => {
      const dependencias = crearDependenciasFalsas()
      const servicio = crearServicioBitacora(dependencias)

      await servicio.registrar({ tipo: 'entrada_correcta', usuarioId: 5 })

      expect(dependencias.insertarEvento).toHaveBeenCalledWith({
        tipo: 'entrada_correcta',
        usuarioId: 5,
      })
    })

    it('si la base falla no lanza error y solo escribe el mensaje', async () => {
      const dependencias = crearDependenciasFalsas()
      dependencias.insertarEvento.mockRejectedValue(new Error('sin conexion'))
      const aviso = vi.spyOn(console, 'error').mockImplementation(() => {})
      const servicio = crearServicioBitacora(dependencias)

      await expect(
        servicio.registrar({ tipo: 'entrada_correcta' }),
      ).resolves.toBeUndefined()
      expect(aviso).toHaveBeenCalledWith(
        'No se pudo escribir en la bitacora:',
        'sin conexion',
      )
    })
  })

  describe('listar', () => {
    it('pide todos los tipos y un evento de más para saber si quedan', async () => {
      const dependencias = crearDependenciasFalsas()
      const servicio = crearServicioBitacora(dependencias)

      await servicio.listar({})

      expect(dependencias.listarEventos).toHaveBeenCalledWith({
        tipos: null,
        antes: null,
        limite: 51,
      })
    })

    it('con el grupo alertas filtra solo esos tipos', async () => {
      const dependencias = crearDependenciasFalsas()
      const servicio = crearServicioBitacora(dependencias)

      await servicio.listar({ grupo: 'alertas', antes: '40', limite: '10' })

      expect(dependencias.listarEventos).toHaveBeenCalledWith({
        tipos: TIPOS_ALERTA,
        antes: 40,
        limite: 11,
      })
    })

    it('avisa que hay más y no entrega el evento sobrante', async () => {
      const dependencias = crearDependenciasFalsas()
      dependencias.listarEventos.mockResolvedValue([
        crearEvento(3),
        crearEvento(2),
        crearEvento(1),
      ])
      const servicio = crearServicioBitacora(dependencias)

      const resultado = await servicio.listar({ limite: '2' })

      expect(resultado).toEqual({
        ok: true,
        eventos: [crearEvento(3), crearEvento(2)],
        hayMas: true,
      })
    })

    it('avisa que ya no hay más cuando caben todos', async () => {
      const dependencias = crearDependenciasFalsas()
      dependencias.listarEventos.mockResolvedValue([crearEvento(1)])
      const servicio = crearServicioBitacora(dependencias)

      const resultado = await servicio.listar({ limite: '2' })

      expect(resultado).toEqual({
        ok: true,
        eventos: [crearEvento(1)],
        hayMas: false,
      })
    })

    it('rechaza una consulta inválida sin tocar la base', async () => {
      const dependencias = crearDependenciasFalsas()
      const servicio = crearServicioBitacora(dependencias)

      const resultado = await servicio.listar({ grupo: 'otro' })

      expect(resultado.ok).toBe(false)
      expect(dependencias.listarEventos).not.toHaveBeenCalled()
    })
  })
})
