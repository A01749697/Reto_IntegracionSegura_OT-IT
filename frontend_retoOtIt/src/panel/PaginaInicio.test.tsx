import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Usuario } from '../login/apiPanel'
import type { Cuenta, ResultadoLista } from './apiAdministracion'
import type { EventoBitacora, ResultadoBitacora } from './apiBitacora'
import type { EstadoSistema, ResultadoEstado } from './apiSistema'
import PaginaInicio from './PaginaInicio'

const admin: Usuario = {
  id: 2,
  nombre: 'Eduardo Serrano',
  correo: 'eduardo@ejemplo.com',
  rol: 'administrador',
}
const normal: Usuario = { ...admin, id: 5, rol: 'usuario' }

const estadoBase: EstadoSistema = {
  api: 'ok',
  baseDatosPanel: 'ok',
  baseDatosLecturas: 'ok',
  datos: 'al_dia',
  variables: [
    {
      plc: 'S7-1500',
      variable: 'a',
      ts: '2026-11-06T18:00:00Z',
      segundosDesdeRecibida: 30,
    },
    {
      plc: 'S7-1200',
      variable: 'b',
      ts: '2026-11-06T18:00:00Z',
      segundosDesdeRecibida: 90,
    },
  ],
}

const cuenta = (id: number): Cuenta => ({
  id,
  nombre: `Persona ${id}`,
  correo: `p${id}@ejemplo.com`,
  rol: 'usuario',
  estado: 'pendiente',
  bloqueada: false,
  creadoEn: '2026-11-01T18:00:00Z',
})

const evento = (id: number, tipo = 'entrada_correcta'): EventoBitacora => ({
  id,
  ocurrioEn: '2026-11-06T18:00:00.000Z',
  tipo,
  usuarioId: 1,
  correo: `persona${id}@ejemplo.com`,
  ip: '203.0.113.7',
  actorCorreo: null,
})

function preparar(
  usuario: Usuario,
  respuestas: {
    estado?: ResultadoEstado
    cuentas?: ResultadoLista
    eventos?: ResultadoBitacora
  } = {},
) {
  const props = {
    usuario,
    obtenerEstado: vi
      .fn()
      .mockResolvedValue(respuestas.estado ?? { ok: true, estado: estadoBase }),
    listarPendientes: vi
      .fn()
      .mockResolvedValue(respuestas.cuentas ?? { ok: true, cuentas: [] }),
    listarEventos: vi
      .fn()
      .mockResolvedValue(
        respuestas.eventos ?? { ok: true, eventos: [], hayMas: false },
      ),
    irA: vi.fn(),
    sesionCaducada: vi.fn(),
  }
  render(<PaginaInicio {...props} />)
  return props
}

beforeEach(() => vi.clearAllMocks())

describe('PaginaInicio', () => {
  it('lleva el título Inicio y saluda con nombre, correo y rol', async () => {
    preparar(admin)
    expect(screen.getByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
    expect(screen.getByText('Eduardo Serrano')).toBeInTheDocument()
    expect(screen.getByText('eduardo@ejemplo.com')).toBeInTheDocument()
    expect(screen.getByText('administrador')).toBeInTheDocument()
    await screen.findByText('Todo responde')
  })

  it('el administrador ve las cuentas pendientes y los últimos eventos', async () => {
    preparar(admin, {
      cuentas: { ok: true, cuentas: [cuenta(1), cuenta(2), cuenta(3)] },
      eventos: {
        ok: true,
        eventos: [evento(1), evento(2, 'entrada_fallida')],
        hayMas: false,
      },
    })
    expect(await screen.findByText('3')).toBeInTheDocument()
    expect(
      screen.getByText('Esperan que las apruebes o las rechaces'),
    ).toBeInTheDocument()
    expect(await screen.findByText('Inició sesión')).toBeInTheDocument()
    expect(
      screen.getByText('Intento de entrada con datos incorrectos'),
    ).toBeInTheDocument()
  })

  it('sin pendientes dice que nadie espera', async () => {
    preparar(admin)
    expect(
      await screen.findByText('Nadie espera aprobación'),
    ).toBeInTheDocument()
    expect(
      await screen.findByText('Todavía no hay eventos.'),
    ).toBeInTheDocument()
  })

  it('muestra solo los 6 eventos más recientes', async () => {
    preparar(admin, {
      eventos: {
        ok: true,
        eventos: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => evento(n)),
        hayMas: true,
      },
    })
    await screen.findAllByText('Inició sesión')
    expect(screen.getAllByText('Inició sesión')).toHaveLength(6)
  })

  it('un usuario normal no ve cuentas ni eventos y no los pide', async () => {
    const props = preparar(normal)
    await screen.findByText('Todo responde')
    expect(screen.queryByText('Cuentas pendientes')).not.toBeInTheDocument()
    expect(
      screen.queryByText('Últimos eventos de seguridad'),
    ).not.toBeInTheDocument()
    expect(props.listarPendientes).not.toHaveBeenCalled()
    expect(props.listarEventos).not.toHaveBeenCalled()
  })

  it('resume el estado: servicios, llegada de datos y variables', async () => {
    preparar(admin)
    expect(await screen.findByText('Todo responde')).toBeInTheDocument()
    expect(screen.getByText('Al día')).toBeInTheDocument()
    expect(screen.getByText('Última lectura hace 30 s')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('avisa cuántos servicios fallan y si la llegada va retrasada', async () => {
    preparar(admin, {
      estado: {
        ok: true,
        estado: {
          ...estadoBase,
          baseDatosLecturas: 'falla',
          datos: 'retrasado',
        },
      },
    })
    expect(await screen.findByText('1 con falla')).toBeInTheDocument()
    expect(screen.getByText('Retrasado')).toBeInTheDocument()
  })

  it('sin lecturas todavía lo dice', async () => {
    preparar(admin, {
      estado: {
        ok: true,
        estado: { ...estadoBase, datos: 'sin_datos', variables: [] },
      },
    })
    expect(await screen.findByText('Sin lecturas')).toBeInTheDocument()
    expect(screen.getByText('Aún no llega ninguna lectura')).toBeInTheDocument()
  })

  it('si una consulta falla, lo dice sin romper el resto', async () => {
    preparar(admin, {
      estado: { ok: false, motivo: 'fallo' },
      cuentas: { ok: false, motivo: 'fallo' },
      eventos: { ok: false, motivo: 'fallo' },
    })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudieron cargar los eventos.',
    )
    expect(screen.getAllByText('No se pudo cargar').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
  })

  it('avisa que la sesión caducó si alguna consulta da 401', async () => {
    const props = preparar(admin, { estado: { ok: false, motivo: 'sesion' } })
    await waitFor(() => expect(props.sesionCaducada).toHaveBeenCalled())
  })

  it('los botones llevan a su pantalla', async () => {
    const props = preparar(admin)
    await screen.findByText('Todo responde')
    fireEvent.click(screen.getByRole('button', { name: 'Revisar cuentas' }))
    expect(props.irA).toHaveBeenLastCalledWith('cuentas')
    fireEvent.click(screen.getByRole('button', { name: 'Ver estado' }))
    expect(props.irA).toHaveBeenLastCalledWith('estado')
    fireEvent.click(screen.getByRole('button', { name: 'Ver bitácora' }))
    expect(props.irA).toHaveBeenLastCalledWith('bitacora')
  })

  it('avisa que el dashboard todavía no está', async () => {
    preparar(admin)
    expect(screen.getByText(/Todavía no está el dashboard/)).toBeInTheDocument()
    await screen.findByText('Todo responde')
  })
})
