import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RecursosServidor, ResultadoServidor } from './apiSistema'
import SeccionServidor from './SeccionServidor'

const GB = 1024 ** 3

const recursosBase: RecursosServidor = {
  generadoEn: '2026-11-22T12:00:00.000Z',
  disco: { totalBytes: 10 * GB, usadoBytes: 3 * GB },
  memoria: {
    totalBytes: 2 * GB,
    disponibleBytes: 1 * GB,
    swapTotalBytes: 1 * GB,
    swapUsadoBytes: 0,
  },
  cpu: { nucleos: 1, carga1: 0.2, carga5: 0.3, carga15: 0.1 },
  baseDatos: { totalBytes: 9 * 1024 * 1024, lecturasBytes: 4 * 1024 * 1024 },
  certificado: { venceEn: '2027-02-01T12:00:00.000Z', diasRestantes: 71 },
  servicios: {
    baseDatosPanel: 'ok',
    baseDatosLecturas: 'ok',
    apiReceptora: 'ok',
  },
}

function preparar(resultado: ResultadoServidor) {
  const props = {
    obtener: vi.fn().mockResolvedValue(resultado),
    sesionCaducada: vi.fn(),
    recarga: 0,
  }
  render(<SeccionServidor {...props} />)
  return props
}

const bien = (cambios: Partial<RecursosServidor> = {}): ResultadoServidor => ({
  ok: true,
  recursos: { ...recursosBase, ...cambios },
})

beforeEach(() => vi.clearAllMocks())

describe('SeccionServidor', () => {
  it('muestra disco, memoria, procesador, base y certificado', async () => {
    preparar(bien())
    expect(
      await screen.findByRole('heading', { name: 'Servidor en la nube' }),
    ).toBeInTheDocument()

    expect(screen.getByRole('progressbar', { name: 'Disco' })).toHaveAttribute(
      'aria-valuenow',
      '30',
    )
    expect(screen.getByText('3 GB usados de 10 GB')).toBeInTheDocument()
    expect(
      screen.getByRole('progressbar', { name: 'Memoria' }),
    ).toHaveAttribute('aria-valuenow', '50')
    expect(screen.getByText('0.3 (5 min)')).toBeInTheDocument()
    expect(screen.getByText('9 MB')).toBeInTheDocument()
    expect(screen.getByText('71 días')).toBeInTheDocument()
    expect(screen.getAllByText('Responde')).toHaveLength(3)
  })

  it('un disco casi lleno se marca en alerta', async () => {
    preparar(bien({ disco: { totalBytes: 10 * GB, usadoBytes: 9 * GB } }))
    const barra = await screen.findByRole('progressbar', { name: 'Disco' })
    expect(barra).toHaveAttribute('aria-valuenow', '90')
    expect(barra.firstElementChild).toHaveClass('bg-alerta')
  })

  it('un disco con poco uso se marca en verde', async () => {
    preparar(bien())
    const barra = await screen.findByRole('progressbar', { name: 'Disco' })
    expect(barra.firstElementChild).toHaveClass('bg-ok')
  })

  it('sin swap lo dice en lugar de mostrar una barra', async () => {
    preparar(
      bien({
        memoria: {
          totalBytes: 2 * GB,
          disponibleBytes: 1 * GB,
          swapTotalBytes: 0,
          swapUsadoBytes: 0,
        },
      }),
    )
    expect(await screen.findByText('Sin swap')).toBeInTheDocument()
    expect(
      screen.queryByRole('progressbar', { name: /swap/ }),
    ).not.toBeInTheDocument()
  })

  it('una carga de 1 o más por núcleo se marca en alerta', async () => {
    preparar(
      bien({ cpu: { nucleos: 1, carga1: 1.5, carga5: 1.2, carga15: 1 } }),
    )
    expect(await screen.findByText('1.2 (5 min)')).toHaveClass('text-alerta')
  })

  it('un certificado por vencer se marca en alerta', async () => {
    preparar(
      bien({
        certificado: { venceEn: '2026-12-01T12:00:00.000Z', diasRestantes: 9 },
      }),
    )
    expect(await screen.findByText('9 días')).toHaveClass('text-alerta')
  })

  it('un certificado vencido lo dice', async () => {
    preparar(
      bien({
        certificado: { venceEn: '2026-11-20T12:00:00.000Z', diasRestantes: -2 },
      }),
    )
    expect(await screen.findByText('Vencido')).toBeInTheDocument()
  })

  it('una medición en null dice No disponible y las demás se ven', async () => {
    preparar(bien({ disco: null, certificado: null }))
    expect(await screen.findAllByText('No disponible')).toHaveLength(2)
    expect(
      screen.getByRole('progressbar', { name: 'Memoria' }),
    ).toBeInTheDocument()
  })

  it('si la API receptora no responde, lo marca', async () => {
    preparar(
      bien({
        servicios: {
          baseDatosPanel: 'ok',
          baseDatosLecturas: 'ok',
          apiReceptora: 'falla',
        },
      }),
    )
    expect(await screen.findByText('No responde')).toBeInTheDocument()
    expect(screen.getAllByText('Responde')).toHaveLength(2)
  })

  it('si la consulta falla, avisa', async () => {
    preparar({ ok: false, motivo: 'fallo' })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo consultar el servidor.',
    )
  })

  it('si la sesión caduca, avisa a la aplicación', async () => {
    const props = preparar({ ok: false, motivo: 'sesion' })
    await waitFor(() => expect(props.sesionCaducada).toHaveBeenCalledTimes(1))
  })
})
