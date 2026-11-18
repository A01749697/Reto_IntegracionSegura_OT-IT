import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TARJETA } from '../comun/estilos'
import type {
  EstadoCubeta,
  ResultadoDisponibilidad,
  VentanaDisponibilidad,
} from './apiSistema'
import { duracion, fechaHoraCorta } from './tiempo'

type Props = {
  obtener: (ventana: VentanaDisponibilidad) => Promise<ResultadoDisponibilidad>
  sesionCaducada: () => void
  // sube cada vez que se pulsa "Actualizar" en la pantalla de Estado
  recarga: number
}

const VENTANAS: VentanaDisponibilidad[] = ['24h', '7d']

// Cada estado se distingue por color y por dibujo, no solo por color.
const FONDO: Record<EstadoCubeta, string> = {
  con_datos: 'bg-ok',
  sin_datos: 'bg-alerta',
  sin_historial: 'bg-linea',
  en_curso: 'border border-dashed border-suave bg-transparent',
}

const RAYADO =
  'repeating-linear-gradient(135deg, transparent 0 3px, var(--color-panel) 3px 5px)'

function Muestra({ estado }: { estado: EstadoCubeta }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-3 w-3 shrink-0 rounded-[2px] ${FONDO[estado]}`}
      style={estado === 'sin_datos' ? { backgroundImage: RAYADO } : undefined}
    />
  )
}

type Carga = {
  clave: string
  resultado: ResultadoDisponibilidad
}

export default function HistorialDisponibilidad({
  obtener,
  sesionCaducada,
  recarga,
}: Props) {
  const { t } = useTranslation()
  const [ventana, setVentana] = useState<VentanaDisponibilidad>('24h')
  const [carga, setCarga] = useState<Carga | null>(null)
  const clave = `${ventana}:${recarga}`

  useEffect(() => {
    let vigente = true
    obtener(ventana).then((resultado) => {
      if (!vigente) return
      if (!resultado.ok && resultado.motivo === 'sesion') sesionCaducada()
      else setCarga({ clave, resultado })
    })
    return () => {
      vigente = false
    }
  }, [obtener, ventana, clave, sesionCaducada])

  const cargando = carga === null || carga.clave !== clave
  const disponibilidad =
    !cargando && carga.resultado.ok ? carga.resultado.disponibilidad : null
  const periodo = t(`estado.historial.ventanas.${ventana}`)

  const resumen = disponibilidad?.resumen
  const etiquetaGrafica =
    resumen === undefined
      ? periodo
      : resumen.porcentaje === null
        ? t('estado.historial.sinPorcentaje', { periodo })
        : t('estado.historial.grafica', {
            periodo,
            porcentaje: resumen.porcentaje,
            interrupciones: t('estado.historial.interrupciones', {
              count: resumen.interrupciones,
            }),
          })

  const presentes = new Set(disponibilidad?.cubetas.map((c) => c.estado))
  const ORDEN_LEYENDA: EstadoCubeta[] = [
    'con_datos',
    'sin_datos',
    'sin_historial',
    'en_curso',
  ]

  return (
    <section
      aria-labelledby="titulo-historial"
      className={`${TARJETA} flex flex-col gap-4 px-5 py-4`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="titulo-historial" className="text-[15px] font-bold">
            {t('estado.historial.titulo')}
          </h2>
          <p className="text-[12.5px] text-suave">
            {t('estado.historial.subtitulo')}
          </p>
        </div>
        <div
          role="group"
          aria-label={t('estado.historial.periodo')}
          className="inline-flex overflow-hidden rounded-lg border-[1.5px] border-linea"
        >
          {VENTANAS.map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={v === ventana}
              onClick={() => setVentana(v)}
              className={`h-9 cursor-pointer px-3.5 text-[13px] font-semibold focus-visible:ring-[3px] focus-visible:ring-acento/45 focus-visible:outline-none ${
                v === ventana
                  ? 'bg-acento text-sobre'
                  : 'text-texto hover:bg-acento/10'
              }`}
            >
              {t(`estado.historial.ventanas.${v}`)}
            </button>
          ))}
        </div>
      </div>

      {cargando && (
        <p className="text-[14px] text-suave">
          {t('estado.historial.cargando')}
        </p>
      )}

      {!cargando && !disponibilidad && (
        <p role="alert" className="text-[14px] text-alerta">
          {t('estado.historial.error')}
        </p>
      )}

      {disponibilidad && resumen && (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-[12.5px] text-suave">
                {t('estado.historial.porcentaje')}
              </dt>
              <dd className="text-[22px] leading-tight font-bold">
                {resumen.porcentaje === null ? '-' : `${resumen.porcentaje} %`}
              </dd>
            </div>
            <div>
              <dt className="text-[12.5px] text-suave">
                {t('estado.historial.interrupciones')}
              </dt>
              <dd className="text-[22px] leading-tight font-bold">
                {resumen.interrupciones}
              </dd>
            </div>
            <div>
              <dt className="text-[12.5px] text-suave">
                {t('estado.historial.mayorCorte')}
              </dt>
              <dd className="text-[22px] leading-tight font-bold">
                {resumen.mayorCorteSegundos === 0
                  ? t('estado.historial.ninguna')
                  : duracion(resumen.mayorCorteSegundos)}
              </dd>
            </div>
          </dl>

          {resumen.porcentaje === null && (
            <p className="text-[14px] text-suave">
              {t('estado.historial.sinHistoria')}
            </p>
          )}

          <div>
            <div
              role="img"
              aria-label={etiquetaGrafica}
              className="flex h-11 items-stretch gap-px"
            >
              {disponibilidad.cubetas.map((c) => (
                <span
                  key={c.inicio}
                  title={`${fechaHoraCorta(c.inicio)}: ${t('estado.historial.lecturas', { count: c.lecturas })}`}
                  className={`min-w-0 flex-1 rounded-[2px] ${FONDO[c.estado]}`}
                  style={
                    c.estado === 'sin_datos'
                      ? { backgroundImage: RAYADO }
                      : undefined
                  }
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[12px] text-suave">
              <span>{t(`estado.historial.inicioEje.${ventana}`)}</span>
              <span>{t('estado.historial.ahora')}</span>
            </div>
          </div>

          <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px] text-suave">
            {ORDEN_LEYENDA.filter((e) => presentes.has(e)).map((e) => (
              <li key={e} className="flex items-center gap-2">
                <Muestra estado={e} />
                {t(`estado.historial.leyenda.${e}`)}
              </li>
            ))}
          </ul>

          <div className="border-t border-linea pt-3">
            <h3 className="pb-2 text-[13.5px] font-bold">
              {t('estado.historial.cortes.titulo')}
            </h3>
            {disponibilidad.cortes.length === 0 ? (
              <p className="text-[13.5px] text-suave">
                {t('estado.historial.cortes.ninguno')}
              </p>
            ) : (
              <ul className="flex flex-col gap-2 text-[13.5px]">
                {disponibilidad.cortes.map((corte) => (
                  <li
                    key={corte.desde}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1"
                  >
                    <span>
                      {t('estado.historial.cortes.desdeHasta', {
                        desde: fechaHoraCorta(corte.desde),
                        hasta: corte.enCurso
                          ? t('estado.historial.ahora')
                          : fechaHoraCorta(corte.hasta),
                      })}
                    </span>
                    <span className="text-suave">
                      {t('estado.historial.cortes.duro', {
                        tiempo: duracion(
                          (new Date(corte.hasta).getTime() -
                            new Date(corte.desde).getTime()) /
                            1000,
                        ),
                      })}
                    </span>
                    {corte.enCurso && (
                      <span className="rounded-full border border-alerta/50 bg-alerta/10 px-2 py-0.5 text-[12px] font-semibold text-alerta">
                        {t('estado.historial.cortes.enCurso')}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-[12.5px] text-suave">
            {t('estado.historial.nota', {
              tramo: duracion(disponibilidad.cubetaSegundos),
            })}
          </p>
        </>
      )}
    </section>
  )
}
