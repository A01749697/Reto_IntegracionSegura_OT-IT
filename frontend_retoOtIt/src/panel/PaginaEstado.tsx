import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { ComponentType } from 'react'
import { AlertCircle, CheckCircle, Database, Pulse, Server } from 'reicon-react'
import { boton, TARJETA } from '../comun/estilos'
import type { EstadoDatos, EstadoSistema, ResultadoEstado } from './apiSistema'
import MarcoPanel from './MarcoPanel'
import { fechaHora, hace } from './tiempo'

type Props = {
  obtener: () => Promise<ResultadoEstado>
  sesionCaducada: () => void
}

type Tono = 'bien' | 'mal' | 'neutro'

const TONO_DATOS: Record<EstadoDatos, Tono> = {
  al_dia: 'bien',
  retrasado: 'mal',
  sin_datos: 'neutro',
  desconocido: 'mal',
}

const ESTILOS: Record<Tono, string> = {
  bien: 'border-ok/50 bg-ok/10 text-ok',
  mal: 'border-alerta/50 bg-alerta/10 text-alerta',
  neutro: 'border-linea bg-panel text-suave',
}

type Icono = ComponentType<{ size?: number; className?: string }>

function Tarjeta({
  nombre,
  tono,
  texto,
  detalle,
  Icono,
}: {
  nombre: string
  tono: Tono
  texto: string
  detalle: string
  Icono: Icono
}) {
  return (
    <div
      className={`flex items-start gap-3.5 rounded-[10px] border px-5 py-4 ${ESTILOS[tono]}`}
    >
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-current/30"
      >
        <Icono size={20} />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-[13px] font-semibold">{nombre}</p>
        <p className="flex items-center gap-2 text-[15px] font-bold">
          {tono === 'bien' ? (
            <CheckCircle size={18} aria-hidden="true" />
          ) : (
            <AlertCircle size={18} aria-hidden="true" />
          )}
          <span>{texto}</span>
        </p>
        <p className="text-[12.5px] text-suave">{detalle}</p>
      </div>
    </div>
  )
}

// la lectura mas reciente de todas, para la tarjeta de llegada de datos
function detalleDatos(estado: EstadoSistema, t: TFunction): string {
  if (estado.variables.length === 0) return t('general.sinLecturas')
  const menor = Math.min(
    ...estado.variables.map((v) => v.segundosDesdeRecibida),
  )
  return t('general.ultimaLectura', { hace: hace(menor) })
}

const tonoDe = (parte: 'ok' | 'falla'): Tono =>
  parte === 'ok' ? 'bien' : 'mal'

type Carga = { version: number; estado: EstadoSistema | null }

export default function PaginaEstado({ obtener, sesionCaducada }: Props) {
  const { t } = useTranslation()
  const [version, setVersion] = useState(0)
  const [carga, setCarga] = useState<Carga | null>(null)

  useEffect(() => {
    let vigente = true
    obtener().then((resultado) => {
      if (!vigente) return
      if (!resultado.ok && resultado.motivo === 'sesion') sesionCaducada()
      else setCarga({ version, estado: resultado.ok ? resultado.estado : null })
    })
    return () => {
      vigente = false
    }
  }, [obtener, version, sesionCaducada])

  const cargando = carga === null || carga.version !== version
  const estado = !cargando ? carga.estado : null

  return (
    <MarcoPanel titulo={t('estado.titulo')}>
      <div className="flex justify-end">
        <button
          type="button"
          disabled={cargando}
          onClick={() => setVersion((v) => v + 1)}
          className={boton('neutro')}
        >
          {t('general.actualizar')}
        </button>
      </div>

      {cargando && <p className="text-suave">{t('general.cargando')}</p>}

      {!cargando && !estado && (
        <p role="alert" className="text-[14px] text-alerta">
          {t('estado.error')}
        </p>
      )}

      {estado && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Tarjeta
              nombre={t('estado.api.nombre')}
              tono="bien"
              texto={t('estado.responde')}
              detalle={t('estado.api.detalle')}
              Icono={Server}
            />
            <Tarjeta
              nombre={t('estado.basePanel.nombre')}
              tono={tonoDe(estado.baseDatosPanel)}
              texto={
                estado.baseDatosPanel === 'ok'
                  ? t('estado.responde')
                  : t('estado.noResponde')
              }
              detalle={t('estado.basePanel.detalle')}
              Icono={Database}
            />
            <Tarjeta
              nombre={t('estado.baseLecturas.nombre')}
              tono={tonoDe(estado.baseDatosLecturas)}
              texto={
                estado.baseDatosLecturas === 'ok'
                  ? t('estado.responde')
                  : t('estado.noResponde')
              }
              detalle={t('estado.baseLecturas.detalle')}
              Icono={Database}
            />
            <Tarjeta
              nombre={t('estado.llegada.nombre')}
              tono={TONO_DATOS[estado.datos]}
              texto={t(`estado.llegada.estados.${estado.datos}`)}
              detalle={detalleDatos(estado, t)}
              Icono={Pulse}
            />
          </div>

          {estado.variables.length === 0 ? (
            <p className="text-[14px] text-suave">{t('estado.sinVariables')}</p>
          ) : (
            <div className={`${TARJETA} overflow-x-auto px-5 py-4`}>
              <table className="w-full text-left text-[14px]">
                <caption className="pb-2 text-left text-[15px] font-bold">
                  {t('estado.tabla.titulo')}
                </caption>
                <thead className="text-suave">
                  <tr className="border-b border-linea">
                    <th className="py-2 pr-4 font-semibold">
                      {t('estado.tabla.plc')}
                    </th>
                    <th className="py-2 pr-4 font-semibold">
                      {t('estado.tabla.variable')}
                    </th>
                    <th className="py-2 pr-4 font-semibold">
                      {t('estado.tabla.lectura')}
                    </th>
                    <th className="py-2 font-semibold">
                      {t('estado.tabla.llego')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {estado.variables.map((v) => (
                    <tr
                      key={`${v.plc}/${v.variable}`}
                      className="border-b border-linea"
                    >
                      <td className="py-2 pr-4">{v.plc}</td>
                      <td className="py-2 pr-4">{v.variable}</td>
                      <td className="py-2 pr-4">{fechaHora(v.ts)}</td>
                      <td className="py-2">{hace(v.segundosDesdeRecibida)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </MarcoPanel>
  )
}
