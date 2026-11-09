import { leerCampo, llamar } from '../login/apiPanel'

export type Celda = string | number | boolean | null
export type FilaDatos = Record<string, Celda>
export type Columna = { clave: string; titulo: string }
export type TablaDatos = { id: string; nombre: string }

export type ResultadoTablas =
  { ok: true; tablas: TablaDatos[] } | { ok: false; motivo: 'sesion' | 'fallo' }

export type PaginaDatos = {
  columnas: Columna[]
  filas: FilaDatos[]
  hayMas: boolean
}

export type ResultadoDatos =
  ({ ok: true } & PaginaDatos) | { ok: false; motivo: 'sesion' | 'fallo' }

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

const esTabla = (valor: unknown): valor is TablaDatos =>
  esObjeto(valor) &&
  typeof valor.id === 'string' &&
  typeof valor.nombre === 'string'

const esColumna = (valor: unknown): valor is Columna =>
  esObjeto(valor) &&
  typeof valor.clave === 'string' &&
  typeof valor.titulo === 'string'

const esCelda = (valor: unknown): valor is Celda =>
  valor === null ||
  typeof valor === 'string' ||
  typeof valor === 'number' ||
  typeof valor === 'boolean'

const esFila = (valor: unknown): valor is FilaDatos =>
  esObjeto(valor) && Object.values(valor).every(esCelda)

export async function listarTablas(): Promise<ResultadoTablas> {
  try {
    const { estado, datos } = await llamar('GET', '/administracion/datos')
    if (estado === 401 || estado === 403) return { ok: false, motivo: 'sesion' }
    const tablas = leerCampo(datos, 'tablas')
    if (estado !== 200 || !Array.isArray(tablas) || !tablas.every(esTabla)) {
      return { ok: false, motivo: 'fallo' }
    }
    // del catálogo solo hace falta el nombre; las columnas vienen con cada consulta
    return {
      ok: true,
      tablas: tablas.map(({ id, nombre }) => ({ id, nombre })),
    }
  } catch {
    return { ok: false, motivo: 'fallo' }
  }
}

// antes = id de la última fila que ya se ve, para pedir las que siguen
export async function leerDatos(
  tabla: string,
  buscar: string,
  antes?: number,
): Promise<ResultadoDatos> {
  try {
    const consulta = new URLSearchParams()
    if (buscar !== '') consulta.set('buscar', buscar)
    if (antes !== undefined) consulta.set('antes', String(antes))
    const texto = consulta.toString()
    const ruta = `/administracion/datos/${encodeURIComponent(tabla)}${
      texto === '' ? '' : `?${texto}`
    }`

    const { estado, datos } = await llamar('GET', ruta)
    if (estado === 401 || estado === 403) return { ok: false, motivo: 'sesion' }
    const columnas = leerCampo(datos, 'columnas')
    const filas = leerCampo(datos, 'filas')
    const hayMas = leerCampo(datos, 'hayMas')
    if (
      estado !== 200 ||
      !Array.isArray(columnas) ||
      !columnas.every(esColumna) ||
      !Array.isArray(filas) ||
      !filas.every(esFila) ||
      typeof hayMas !== 'boolean'
    ) {
      return { ok: false, motivo: 'fallo' }
    }
    return { ok: true, columnas, filas, hayMas }
  } catch {
    return { ok: false, motivo: 'fallo' }
  }
}
