import { useEffect, useState } from 'react'
import type {
  EventoBitacora,
  GrupoBitacora,
  ResultadoBitacora,
  ResultadoExportar,
} from './apiBitacora'
import { boton, TARJETA } from '../comun/estilos'
import Segmentos from '../comun/Segmentos'
import { describir, esAlerta } from './eventos'
import IconoEvento from './IconoEvento'
import MarcoPanel from './MarcoPanel'
import { fechaHora } from './tiempo'

type Props = {
  listar: (grupo: GrupoBitacora, antes?: number) => Promise<ResultadoBitacora>
  exportar: (grupo: GrupoBitacora) => Promise<ResultadoExportar>
  descargar: (nombre: string, archivo: Blob) => void
  sesionCaducada: () => void
}

const FILTROS: { valor: GrupoBitacora; texto: string }[] = [
  { valor: 'todos', texto: 'Todo' },
  { valor: 'alertas', texto: 'Alertas' },
]

const CELDA_TITULO =
  'border-b border-linea px-4 py-2.5 font-bold whitespace-nowrap'

type Datos = { eventos: EventoBitacora[]; hayMas: boolean }
type Carga = { grupo: GrupoBitacora; version: number; datos: Datos | null }

export default function PaginaBitacora({
  listar,
  exportar,
  descargar,
  sesionCaducada,
}: Props) {
  const [grupo, setGrupo] = useState<GrupoBitacora>('todos')
  const [version, setVersion] = useState(0)
  const [carga, setCarga] = useState<Carga | null>(null)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [errorMas, setErrorMas] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [aviso, setAviso] = useState<{ error: boolean; texto: string } | null>(
    null,
  )

  useEffect(() => {
    let vigente = true
    listar(grupo).then((resultado) => {
      if (!vigente) return
      if (!resultado.ok && resultado.motivo === 'sesion') sesionCaducada()
      else {
        const datos = resultado.ok
          ? { eventos: resultado.eventos, hayMas: resultado.hayMas }
          : null
        setCarga({ grupo, version, datos })
      }
    })
    return () => {
      vigente = false
    }
  }, [listar, grupo, version, sesionCaducada])

  const cargando =
    carga === null || carga.grupo !== grupo || carga.version !== version

  function cambiarGrupo(nuevo: GrupoBitacora) {
    setErrorMas(false)
    setAviso(null)
    setGrupo(nuevo)
  }

  async function descargarCsv() {
    setExportando(true)
    setAviso(null)
    let resultado: ResultadoExportar
    try {
      resultado = await exportar(grupo)
    } catch {
      resultado = { ok: false, motivo: 'fallo' }
    }
    setExportando(false)
    if (resultado.ok) {
      const fecha = new Date().toISOString().slice(0, 10)
      const sufijo = grupo === 'alertas' ? '-alertas' : ''
      descargar(`bitacora${sufijo}-${fecha}.csv`, resultado.archivo)
      setAviso({
        error: false,
        texto: resultado.truncado
          ? 'Archivo descargado. Solo incluye los 5000 eventos más recientes.'
          : 'Archivo descargado.',
      })
    } else if (resultado.motivo === 'sesion') {
      sesionCaducada()
    } else {
      setAviso({
        error: true,
        texto: 'No se pudo descargar el archivo. Inténtalo otra vez.',
      })
    }
  }

  async function cargarMas() {
    const ultimo = carga?.datos?.eventos.at(-1)
    if (cargando || cargandoMas || !ultimo) return
    setCargandoMas(true)
    setErrorMas(false)
    let resultado: ResultadoBitacora
    try {
      resultado = await listar(grupo, ultimo.id)
    } catch {
      resultado = { ok: false, motivo: 'fallo' }
    }
    setCargandoMas(false)
    if (!resultado.ok) {
      if (resultado.motivo === 'sesion') sesionCaducada()
      else setErrorMas(true)
      return
    }
    const { eventos, hayMas } = resultado
    setCarga((previa) =>
      previa?.datos && previa.grupo === grupo && previa.version === version
        ? {
            ...previa,
            datos: { eventos: [...previa.datos.eventos, ...eventos], hayMas },
          }
        : previa,
    )
  }

  return (
    <MarcoPanel titulo="Bitácora de seguridad">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmentos opciones={FILTROS} valor={grupo} alCambiar={cambiarGrupo} />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={exportando}
            onClick={descargarCsv}
            className={boton('neutro')}
          >
            {exportando ? 'Descargando...' : 'Descargar CSV'}
          </button>
          <button
            type="button"
            disabled={cargando}
            onClick={() => setVersion((v) => v + 1)}
            className={boton('neutro')}
          >
            Actualizar
          </button>
        </div>
      </div>

      {aviso && (
        <p
          role={aviso.error ? 'alert' : 'status'}
          className={`text-[14px] ${aviso.error ? 'text-alerta' : 'text-ok'}`}
        >
          {aviso.texto}
        </p>
      )}

      {cargando && <p className="text-suave">Cargando...</p>}

      {!cargando && !carga.datos && (
        <p role="alert" className="text-[14px] text-alerta">
          No se pudo cargar la bitácora. Inténtalo otra vez.
        </p>
      )}

      {!cargando && carga.datos && (
        <>
          {carga.datos.eventos.length === 0 && (
            <p className="text-suave">
              {grupo === 'alertas'
                ? 'No hay alertas registradas.'
                : 'Todavía no hay eventos registrados.'}
            </p>
          )}
          {carga.datos.eventos.length > 0 && (
            <div
              role="region"
              aria-label="Eventos de la bitácora"
              tabIndex={0}
              className={`${TARJETA} overflow-x-auto focus-visible:ring-[3px] focus-visible:ring-acento/45 focus-visible:outline-none`}
            >
              <table className="min-w-full text-left text-[13.5px]">
                <thead>
                  <tr className="text-[12.5px] text-suave">
                    <th scope="col" className={CELDA_TITULO}>
                      Evento
                    </th>
                    <th scope="col" className={CELDA_TITULO}>
                      Cuenta
                    </th>
                    <th scope="col" className={CELDA_TITULO}>
                      IP
                    </th>
                    <th scope="col" className={CELDA_TITULO}>
                      Fecha y hora
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {carga.datos.eventos.map((evento) => (
                    <tr
                      key={evento.id}
                      className="border-b border-linea last:border-b-0 hover:bg-fondo/60"
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <IconoEvento tipo={evento.tipo} />
                          <span className="font-bold">{describir(evento)}</span>
                          {esAlerta(evento.tipo) && (
                            <span className="rounded-[5px] bg-alerta/15 px-2 py-0.5 text-[12px] font-bold text-alerta">
                              Alerta
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-suave">
                        {evento.correo ?? 'Sin correo'}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-suave">
                        {evento.ip ?? 'Sin IP'}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-suave">
                        {fechaHora(evento.ocurrioEn)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {errorMas && (
            <p role="alert" className="text-[14px] text-alerta">
              No se pudieron cargar más eventos. Inténtalo otra vez.
            </p>
          )}
          {carga.datos.hayMas && (
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
    </MarcoPanel>
  )
}
