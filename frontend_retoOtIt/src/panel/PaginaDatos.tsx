import { useEffect, useState, type FormEvent } from 'react'
import { Magnifier } from 'reicon-react'
import { boton, CAMPO_BUSQUEDA, TARJETA } from '../comun/estilos'
import Segmentos from '../comun/Segmentos'
import type {
  Celda,
  PaginaDatos as Pagina,
  ResultadoDatos,
  ResultadoTablas,
  TablaDatos,
} from './apiDatos'
import MarcoPanel from './MarcoPanel'
import { fechaHora } from './tiempo'

type Props = {
  listarTablas: () => Promise<ResultadoTablas>
  leer: (
    tabla: string,
    buscar: string,
    antes?: number,
  ) => Promise<ResultadoDatos>
  sesionCaducada: () => void
}

const PISTAS: Record<string, string> = {
  cuentas: 'Buscar por nombre o correo',
  bitacora: 'Buscar por tipo, correo o IP',
}

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/

function mostrar(valor: Celda): string {
  if (typeof valor === 'boolean') return valor ? 'sí' : 'no'
  if (typeof valor === 'string' && FECHA_ISO.test(valor)) {
    return fechaHora(valor)
  }
  return String(valor)
}

type Carga = {
  tabla: string
  buscar: string
  version: number
  pagina: Pagina | null
}

export default function PaginaDatos({
  listarTablas,
  leer,
  sesionCaducada,
}: Props) {
  const [tablas, setTablas] = useState<TablaDatos[] | null | 'error'>(null)
  const [intento, setIntento] = useState(0)
  const [elegida, setElegida] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [buscar, setBuscar] = useState('')
  const [version, setVersion] = useState(0)
  const [carga, setCarga] = useState<Carga | null>(null)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [errorMas, setErrorMas] = useState(false)

  useEffect(() => {
    let vigente = true
    listarTablas().then((resultado) => {
      if (!vigente) return
      if (resultado.ok) setTablas(resultado.tablas)
      else if (resultado.motivo === 'sesion') sesionCaducada()
      else setTablas('error')
    })
    return () => {
      vigente = false
    }
  }, [listarTablas, sesionCaducada, intento])

  const lista = Array.isArray(tablas) ? tablas : []
  const tabla = elegida ?? lista[0]?.id ?? null

  useEffect(() => {
    if (tabla === null) return
    let vigente = true
    leer(tabla, buscar).then((resultado) => {
      if (!vigente) return
      if (!resultado.ok && resultado.motivo === 'sesion') sesionCaducada()
      else {
        const { columnas, filas, hayMas } = resultado.ok
          ? resultado
          : { columnas: [], filas: [], hayMas: false }
        setCarga({
          tabla,
          buscar,
          version,
          pagina: resultado.ok ? { columnas, filas, hayMas } : null,
        })
      }
    })
    return () => {
      vigente = false
    }
  }, [leer, tabla, buscar, version, sesionCaducada])

  const cargando =
    tabla !== null &&
    (carga === null ||
      carga.tabla !== tabla ||
      carga.buscar !== buscar ||
      carga.version !== version)

  function cambiarTabla(nueva: string) {
    setErrorMas(false)
    setTexto('')
    setBuscar('')
    setElegida(nueva)
  }

  // Buscar es a propósito con Enter o con el botón y no al teclear: cada búsqueda queda anotada en la bitácora.
  function enviarBusqueda(evento: FormEvent) {
    evento.preventDefault()
    setErrorMas(false)
    const nuevo = texto.trim()
    if (nuevo === buscar) setVersion((v) => v + 1)
    else setBuscar(nuevo)
  }

  async function cargarMas() {
    const ultima = carga?.pagina?.filas.at(-1)
    const id = ultima?.id
    if (tabla === null || cargando || cargandoMas || typeof id !== 'number') {
      return
    }
    setCargandoMas(true)
    setErrorMas(false)
    let resultado: ResultadoDatos
    try {
      resultado = await leer(tabla, buscar, id)
    } catch {
      resultado = { ok: false, motivo: 'fallo' }
    }
    setCargandoMas(false)
    if (!resultado.ok) {
      if (resultado.motivo === 'sesion') sesionCaducada()
      else setErrorMas(true)
      return
    }
    const { filas, hayMas } = resultado
    setCarga((previa) =>
      previa?.pagina &&
      previa.tabla === tabla &&
      previa.buscar === buscar &&
      previa.version === version
        ? {
            ...previa,
            pagina: {
              ...previa.pagina,
              filas: [...previa.pagina.filas, ...filas],
              hayMas,
            },
          }
        : previa,
    )
  }

  const nombreTabla = lista.find((t) => t.id === tabla)?.nombre ?? ''
  const pagina = cargando ? null : (carga?.pagina ?? null)

  return (
    <MarcoPanel titulo="Datos">
      <p className="text-[14px] text-suave">
        Solo lectura. Cada vez que abres o buscas en una tabla queda anotado en
        la bitácora de seguridad.
      </p>

      {tablas === null && <p className="text-suave">Cargando...</p>}

      {tablas === 'error' && (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="text-[14px] text-alerta">
            No se pudo cargar la lista de tablas. Inténtalo otra vez.
          </p>
          <button
            type="button"
            onClick={() => {
              setTablas(null)
              setIntento((n) => n + 1)
            }}
            className={boton('neutro')}
          >
            Reintentar
          </button>
        </div>
      )}

      {tabla !== null && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmentos
              etiqueta="Tabla"
              opciones={lista.map((t) => ({ valor: t.id, texto: t.nombre }))}
              valor={tabla}
              alCambiar={cambiarTabla}
            />
            <button
              type="button"
              disabled={cargando}
              onClick={() => setVersion((v) => v + 1)}
              className={boton('neutro')}
            >
              Actualizar
            </button>
          </div>

          <form role="search" onSubmit={enviarBusqueda} className="flex gap-2">
            <div className="relative max-w-[420px] flex-1">
              <Magnifier
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-suave"
              />
              <input
                type="search"
                aria-label="Buscar en la tabla"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                maxLength={60}
                placeholder={PISTAS[tabla] ?? 'Buscar'}
                autoComplete="off"
                className={CAMPO_BUSQUEDA}
              />
            </div>
            <button
              type="submit"
              disabled={cargando}
              className={boton('contorno')}
            >
              Buscar
            </button>
          </form>

          {cargando && <p className="text-suave">Cargando...</p>}

          {!cargando && carga && !carga.pagina && (
            <p role="alert" className="text-[14px] text-alerta">
              No se pudo cargar la tabla. Inténtalo otra vez.
            </p>
          )}

          {pagina && (
            <>
              <p className="text-[13px] text-suave">
                {pagina.filas.length === 0
                  ? buscar === ''
                    ? 'La tabla no tiene filas.'
                    : `Ninguna fila coincide con «${buscar}».`
                  : `${pagina.filas.length} ${
                      pagina.filas.length === 1 ? 'fila' : 'filas'
                    }${pagina.hayMas ? ' (hay más)' : ''}${
                      buscar === '' ? '' : ` con «${buscar}»`
                    }, de la más nueva a la más vieja.`}
              </p>

              {pagina.filas.length > 0 && (
                <div
                  role="region"
                  aria-label={`Tabla ${nombreTabla}`}
                  tabIndex={0}
                  className={`${TARJETA} overflow-x-auto focus-visible:ring-[3px] focus-visible:ring-acento/45 focus-visible:outline-none`}
                >
                  <table className="min-w-full text-left text-[13px]">
                    <thead>
                      <tr>
                        {pagina.columnas.map((columna) => (
                          <th
                            key={columna.clave}
                            scope="col"
                            className="border-b border-linea px-4 py-2.5 text-[12.5px] font-bold whitespace-nowrap text-suave"
                          >
                            {columna.titulo}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pagina.filas.map((fila, indice) => (
                        <tr
                          key={String(fila.id ?? indice)}
                          className="border-b border-linea last:border-b-0 hover:bg-fondo/60"
                        >
                          {pagina.columnas.map((columna) => {
                            const valor = fila[columna.clave] ?? null
                            return (
                              <td
                                key={columna.clave}
                                className="px-4 py-2.5 whitespace-nowrap"
                              >
                                {valor === null ? (
                                  <span className="text-suave">—</span>
                                ) : (
                                  mostrar(valor)
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {errorMas && (
                <p role="alert" className="text-[14px] text-alerta">
                  No se pudieron cargar más filas. Inténtalo otra vez.
                </p>
              )}
              {pagina.hayMas && (
                <button
                  type="button"
                  disabled={cargandoMas}
                  onClick={cargarMas}
                  className={`${boton('neutro')} self-center`}
                >
                  {cargandoMas ? 'Cargando...' : 'Cargar más'}
                </button>
              )}
            </>
          )}
        </>
      )}
    </MarcoPanel>
  )
}
