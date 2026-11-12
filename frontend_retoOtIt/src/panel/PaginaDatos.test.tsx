import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FilaDatos, ResultadoDatos, ResultadoTablas } from './apiDatos'
import i18n from '../idioma/i18n'
import PaginaDatos from './PaginaDatos'

const COLUMNAS_CUENTAS = [
  { clave: 'id', titulo: 'id' },
  { clave: 'nombre', titulo: 'nombre' },
  { clave: 'creadoEn', titulo: 'creada' },
  { clave: 'aprobadoPor', titulo: 'aprobada por (id)' },
]
const COLUMNAS_BITACORA = [
  { clave: 'id', titulo: 'id' },
  { clave: 'tipo', titulo: 'tipo' },
]

function cuenta(id: number, cambios: Partial<FilaDatos> = {}): FilaDatos {
  return {
    id,
    nombre: `Cuenta ${id}`,
    creadoEn: '2026-11-01T10:00:00.000Z',
    aprobadoPor: null,
    ...cambios,
  }
}

const TABLAS: ResultadoTablas = {
  ok: true,
  tablas: [
    { id: 'cuentas', nombre: 'Cuentas' },
    { id: 'bitacora', nombre: 'Bitácora' },
  ],
}

function pagina(filas: FilaDatos[], hayMas = false): ResultadoDatos {
  return { ok: true, columnas: COLUMNAS_CUENTAS, filas, hayMas }
}

function preparar(
  respuesta: ResultadoDatos = pagina([cuenta(2), cuenta(1)]),
  tablas: ResultadoTablas = TABLAS,
) {
  const props = {
    listarTablas: vi
      .fn<() => Promise<ResultadoTablas>>()
      .mockResolvedValue(tablas),
    leer: vi
      .fn<(t: string, b: string, a?: number) => Promise<ResultadoDatos>>()
      .mockResolvedValue(respuesta),
    sesionCaducada: vi.fn(),
  }
  render(<PaginaDatos {...props} />)
  return props
}

beforeEach(() => vi.clearAllMocks())

describe('PaginaDatos', () => {
  it('avisa que es solo lectura y que las consultas quedan anotadas', async () => {
    preparar()
    expect(await screen.findByText(/Solo lectura/)).toHaveTextContent(
      'queda anotado en la bitácora de seguridad',
    )
  })

  it('abre la primera tabla con sus columnas y filas', async () => {
    const props = preparar()
    expect(
      await screen.findByRole('columnheader', { name: 'nombre' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Cuenta 2')).toBeInTheDocument()
    expect(screen.getByText('Cuenta 1')).toBeInTheDocument()
    expect(props.leer).toHaveBeenCalledWith('cuentas', '')
    expect(
      screen.getByRole('button', { name: 'Cuentas', pressed: true }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('2 filas, de la más nueva a la más vieja.'),
    ).toBeInTheDocument()
  })

  it('las celdas vacías se ven como una raya y las fechas en hora local', async () => {
    preparar()
    await screen.findByText('Cuenta 2')
    expect(screen.getAllByText('—')).toHaveLength(2)
    expect(screen.queryByText('2026-11-01T10:00:00.000Z')).toBeNull()
    expect(screen.getAllByText(/2026/)).toHaveLength(2)
  })

  it('un booleano se muestra como sí o no', async () => {
    preparar({
      ok: true,
      columnas: [{ clave: 'activo', titulo: 'activo' }],
      filas: [{ activo: true }, { activo: false }],
      hayMas: false,
    })
    expect(await screen.findByText('sí')).toBeInTheDocument()
    expect(screen.getByText('no')).toBeInTheDocument()
  })

  it('la tabla se puede recorrer con teclado y tiene nombre', async () => {
    preparar()
    const region = await screen.findByRole('region', { name: 'Tabla Cuentas' })
    expect(region).toHaveAttribute('tabindex', '0')
  })

  it('al elegir otra tabla la pide y limpia la búsqueda', async () => {
    const props = preparar()
    await screen.findByText('Cuenta 2')
    const campo = screen.getByRole('searchbox', { name: 'Buscar en la tabla' })
    fireEvent.change(campo, { target: { value: 'ana' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    await waitFor(() =>
      expect(props.leer).toHaveBeenCalledWith('cuentas', 'ana'),
    )

    props.leer.mockResolvedValue({
      ok: true,
      columnas: COLUMNAS_BITACORA,
      filas: [{ id: 9, tipo: 'entrada_correcta' }],
      hayMas: false,
    })
    fireEvent.click(screen.getByRole('button', { name: 'Bitácora' }))

    expect(await screen.findByText('entrada_correcta')).toBeInTheDocument()
    expect(props.leer).toHaveBeenLastCalledWith('bitacora', '')
    expect(campo).toHaveValue('')
  })

  it('buscar manda el texto sin espacios de sobra', async () => {
    const props = preparar()
    await screen.findByText('Cuenta 2')
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: '  ana  ' },
    })
    fireEvent.submit(screen.getByRole('search'))
    await waitFor(() =>
      expect(props.leer).toHaveBeenLastCalledWith('cuentas', 'ana'),
    )
  })

  it('no busca al teclear, solo al enviar', async () => {
    const props = preparar()
    await screen.findByText('Cuenta 2')
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'ana' },
    })
    expect(props.leer).toHaveBeenCalledTimes(1)
  })

  it('sin coincidencias lo dice con las palabras buscadas', async () => {
    const props = preparar()
    await screen.findByText('Cuenta 2')
    props.leer.mockResolvedValue(pagina([]))
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'zzz' },
    })
    fireEvent.submit(screen.getByRole('search'))
    expect(
      await screen.findByText('Ninguna fila coincide con «zzz».'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('una tabla vacía lo dice', async () => {
    preparar(pagina([]))
    expect(
      await screen.findByText('La tabla no tiene filas.'),
    ).toBeInTheDocument()
  })

  it('Actualizar vuelve a pedir la tabla', async () => {
    const props = preparar()
    await screen.findByText('Cuenta 2')
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    await waitFor(() => expect(props.leer).toHaveBeenCalledTimes(2))
  })

  it('Cargar más pide desde el id de la última fila y las agrega', async () => {
    const props = preparar(pagina([cuenta(5), cuenta(4)], true))
    await screen.findByText('Cuenta 5')
    props.leer.mockResolvedValue(pagina([cuenta(3)], false))

    fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }))

    expect(await screen.findByText('Cuenta 3')).toBeInTheDocument()
    expect(props.leer).toHaveBeenLastCalledWith('cuentas', '', 4)
    expect(screen.getByText('Cuenta 5')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull()
  })

  it('si falla Cargar más, avisa y deja las filas', async () => {
    const props = preparar(pagina([cuenta(5)], true))
    await screen.findByText('Cuenta 5')
    props.leer.mockResolvedValue({ ok: false, motivo: 'fallo' })

    fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudieron cargar más filas',
    )
    expect(screen.getByText('Cuenta 5')).toBeInTheDocument()
  })

  it('si la tabla no carga, lo dice', async () => {
    preparar({ ok: false, motivo: 'fallo' })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo cargar la tabla',
    )
  })

  it('si no carga la lista de tablas, deja reintentar', async () => {
    const props = preparar(pagina([]), { ok: false, motivo: 'fallo' })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo cargar la lista de tablas',
    )
    props.listarTablas.mockResolvedValue(TABLAS)
    props.leer.mockResolvedValue(pagina([cuenta(1)]))
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Cuenta 1')).toBeInTheDocument()
  })

  it('si la sesión caducó al listar las tablas, avisa', async () => {
    const props = preparar(pagina([]), { ok: false, motivo: 'sesion' })
    await waitFor(() => expect(props.sesionCaducada).toHaveBeenCalledTimes(1))
  })

  it('si la sesión caducó al leer la tabla, avisa', async () => {
    const props = preparar({ ok: false, motivo: 'sesion' })
    await waitFor(() => expect(props.sesionCaducada).toHaveBeenCalledTimes(1))
  })
})

describe('PaginaDatos en inglés', () => {
  it('traduce el nombre de las tablas y el resumen de filas', async () => {
    await i18n.changeLanguage('en')
    preparar(pagina([cuenta(2), cuenta(1)], true))
    expect(screen.getByRole('heading', { name: 'Data' })).toBeInTheDocument()
    expect(
      await screen.findByText(
        '2 rows (there are more), from newest to oldest.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Accounts' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log' })).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Accounts table' }),
    ).toBeInTheDocument()
  })
})
