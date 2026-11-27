// Operación reciente de la celda: la última hora, 8 h o 24 h de actividad, con el detalle
// que sale del historial de cada nodo: estado de la celda, tiempos que mide el PLC, pasos,
// fallas y lo que clasifica la garra.
//
// La ventana termina en la lectura más reciente de la celda, no en la hora del navegador:
// si la celda está apagada, se ve su última actividad en lugar de gráficas vacías.
import type { TFunction } from 'i18next'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { TARJETA } from '../comun/estilos'
import Segmentos from '../comun/Segmentos'
import type { ResultadoHistorial } from '../gemelo/apiLecturas'
import { SEGUNDOS_ATRASO } from '../gemelo/enVivo'
import type { Lecturas, Valores } from './lecturas'
import { Linea } from '../indicadores/Graficas'
import { fechaHora, hace, region } from '../panel/tiempo'
import {
  duracionesDeCiclo,
  ESTADO_FALLA,
  estadosDeLaCelda,
  fallasEnVentana,
  resumir,
  segundosLegibles,
  tiempoPorValor,
  totalContador,
  tramos,
  valoresEnVentana,
  type Punto,
  type Ventana,
} from './calculos'

export type ObtenerHistorial = (
  plc: string,
  variable: string,
  desde: Date,
  hasta: Date,
) => Promise<ResultadoHistorial>

// Nodos que usa esta parte: del S7-1516 (tablero neumático) y de la garra (S7-300).
const PLC = 'S7-1500'
const GARRA = 'S7-300'
const NODO = {
  torreta: 'TAB_TORRETA', // 1 marcha · 2 mantenimiento · 3 paro o falla · 4 reset
  falla: 'TAB_FALLA',
  codFalla: 'TAB_COD_FALLA',
  paso: 'TAB_PASO',
  tCiclo: 'TAB_T_CICLO_S',
  tCarrera: 'TAB_T_CARRERA_PD1_S',
} as const
const PASOS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

type EstadoTablero =
  'marcha' | 'mantenimiento' | 'reset' | 'paro' | 'falla' | 'sinDato'

// El estado de la celda según TAB_TORRETA (y TAB_FALLA cuando está en paro).
function estadoActual(v: Valores): EstadoTablero {
  switch (v[NODO.torreta]) {
    case 1:
      return 'marcha'
    case 2:
      return 'mantenimiento'
    case 4:
      return 'reset'
    case 3:
      return v[NODO.falla] === 1 ? 'falla' : 'paro'
    default:
      return 'sinDato'
  }
}

export type Rango = '1h' | '8h' | '24h'
const RANGOS: Rango[] = ['1h', '8h', '24h']
const SEGUNDOS_RANGO: Record<Rango, number> = {
  '1h': 3600,
  '8h': 8 * 3600,
  '24h': 24 * 3600,
}
// puntos de las tendencias (los más recientes)
const PUNTOS_TENDENCIA = 40

const SERIES = {
  pasos: { plc: PLC, nodo: NODO.paso },
  torreta: { plc: PLC, nodo: NODO.torreta },
  falla: { plc: PLC, nodo: NODO.falla },
  codFalla: { plc: PLC, nodo: NODO.codFalla },
  tCiclo: { plc: PLC, nodo: NODO.tCiclo },
  tCarrera: { plc: PLC, nodo: NODO.tCarrera },
  garraAl: { plc: GARRA, nodo: 'PIEZAS_ALUMINIO' },
  garraPl: { plc: GARRA, nodo: 'PIEZAS_OTRAS' },
  garraCiclo: { plc: GARRA, nodo: 'TIEMPO_CICLO_S' },
} as const
type Serie = keyof typeof SERIES

type Carga =
  | { estado: 'cargando' }
  | { estado: 'error' }
  | { estado: 'listo'; ventana: Ventana; series: Record<Serie, Punto[]> }

const hora = (instante: number) =>
  new Date(instante).toLocaleTimeString(region(), {
    hour: '2-digit',
    minute: '2-digit',
  })

const nombrePaso = (paso: number, t: TFunction) =>
  `${paso} · ${t(`gemelo.pasosReales.${paso}`, { defaultValue: '—' })}`

export function Operacion({
  lecturas,
  obtenerHistorial,
  sesionCaducada,
  recarga,
}: {
  lecturas: Lecturas | null
  obtenerHistorial: ObtenerHistorial
  sesionCaducada: () => void
  recarga: number
}) {
  const { t } = useTranslation()
  const [rango, setRango] = useState<Rango>('8h')
  const [carga, setCarga] = useState<Carga>({ estado: 'cargando' })
  const hay = lecturas !== null
  const ultimaCelda = lecturas?.ultimaCelda ?? null

  useEffect(() => {
    if (!hay) return
    let vigente = true
    const hasta = ultimaCelda ?? Date.now()
    const largo = SEGUNDOS_RANGO[rango] * 1000
    const ventana = { desde: hasta - largo, hasta }
    // se pide desde una ventana antes, para saber cómo estaba todo al empezar
    const claves = Object.keys(SERIES) as Serie[]
    Promise.all(
      claves.map((clave) =>
        obtenerHistorial(
          SERIES[clave].plc,
          SERIES[clave].nodo,
          new Date(ventana.desde - largo),
          new Date(hasta + 1000),
        ),
      ),
    ).then((historiales) => {
      if (!vigente) return
      if (historiales.some((h) => !h.ok && h.motivo === 'sesion')) {
        sesionCaducada()
        return
      }
      if (historiales.every((h) => !h.ok)) {
        setCarga({ estado: 'error' })
        return
      }
      const series = Object.fromEntries(
        claves.map((clave, i) => {
          const h = historiales[i]
          return [clave, h.ok ? h.puntos : []]
        }),
      ) as Record<Serie, Punto[]>
      setCarga({ estado: 'listo', ventana, series })
    })
    return () => {
      vigente = false
    }
  }, [hay, ultimaCelda, rango, recarga, obtenerHistorial, sesionCaducada])

  return (
    <section
      aria-label={t('tablero.operacion.titulo')}
      className="flex flex-col gap-5"
    >
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-linea pt-5">
        <h2 className="text-[19px] font-bold">
          {t('tablero.operacion.titulo')}
        </h2>
        <Segmentos
          etiqueta={t('tablero.rango')}
          opciones={RANGOS.map((valor) => ({
            valor,
            texto: t(`tablero.rangos.${valor}`),
          }))}
          valor={rango}
          alCambiar={(valor) => {
            setCarga({ estado: 'cargando' })
            setRango(valor)
          }}
        />
        {carga.estado === 'listo' && (
          <span className="text-[13px] text-suave">
            {t('tablero.periodo', {
              desde: fechaHora(new Date(carga.ventana.desde).toISOString()),
              hasta: fechaHora(new Date(carga.ventana.hasta).toISOString()),
            })}
          </span>
        )}
      </div>
      {carga.estado === 'cargando' && (
        <p role="status" className="text-suave">
          {t('general.cargando')}
        </p>
      )}
      {carga.estado === 'error' && (
        <p role="alert" className="text-alerta">
          {t('tablero.error')}
        </p>
      )}
      {carga.estado === 'listo' && (
        <Contenido ventana={carga.ventana} series={carga.series} />
      )}
    </section>
  )
}

const LETRERO: Record<EstadoTablero, string> = {
  marcha: 'border-ok bg-ok/10 text-ok',
  mantenimiento: 'border-aviso bg-aviso/10 text-aviso',
  reset: 'border-aviso bg-aviso/10 text-aviso',
  paro: 'border-alerta bg-alerta/10 text-alerta',
  falla: 'border-alerta bg-alerta/15 text-alerta',
  sinDato: 'border-linea text-suave',
}

// La franja de arriba: cómo está la celda en este momento.
export function Ahora({ lecturas }: { lecturas: Lecturas }) {
  const { t } = useTranslation()
  const { ahora, atraso } = lecturas
  const quieta = atraso !== null && atraso > SEGUNDOS_ATRASO
  const estado = estadoActual(ahora)
  const paso = ahora[NODO.paso]
  return (
    <section
      aria-label={t('tablero.ahora')}
      className={`${TARJETA} flex flex-wrap items-center gap-x-6 gap-y-2 p-4`}
    >
      <span
        className={`rounded-md border-2 px-3 py-1 text-[15px] font-bold tracking-wider ${LETRERO[estado]}`}
      >
        {t(`tablero.estadoCelda.${estado}`)}
        {estado === 'falla' &&
          ` · ${t('tablero.codigoFalla', { codigo: ahora[NODO.codFalla] ?? 0 })}`}
      </span>
      <span className="text-[13px] text-suave">
        {t('tablero.paso')}{' '}
        <span className="font-bold text-texto">
          {paso === undefined ? t('tablero.kpi.sinDato') : nombrePaso(paso, t)}
        </span>
      </span>
      {lecturas.ultimaCelda === null ? (
        <span className="text-[13px] text-alerta">
          {t('tablero.sinLecturas')}
        </span>
      ) : (
        quieta && (
          <span className="text-[13px] text-alerta">
            {t('tablero.celdaQuieta', { hace: hace(atraso) })}
          </span>
        )
      )}
    </section>
  )
}

function Contenido({
  ventana,
  series,
}: {
  ventana: Ventana
  series: Record<Serie, Punto[]>
}) {
  const { t } = useTranslation()
  const estados = estadosDeLaCelda(series.torreta, series.falla)
  const tiempos = tiempoPorValor(estados, ventana)

  // el tiempo de ciclo lo mide el PLC; si no llega, se calcula con los pasos
  const ciclosPlc = valoresEnVentana(series.tCiclo, ventana)
  const ciclo = resumir(
    ciclosPlc.length
      ? ciclosPlc.map((p) => p.valor)
      : duracionesDeCiclo(series.pasos, ventana),
  )
  const carreras = valoresEnVentana(series.tCarrera, ventana)
  const carrera = resumir(carreras.map((p) => p.valor))
  const ciclosGarra = valoresEnVentana(series.garraCiclo, ventana)
  const cicloGarra = resumir(ciclosGarra.map((p) => p.valor))
  const garraAl = totalContador(series.garraAl, ventana)
  const garraPl = totalContador(series.garraPl, ventana)
  const fallas = fallasEnVentana(series.falla, series.codFalla, ventana)

  return (
    <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Indicador
          titulo={t('tablero.kpi.cicloCelda')}
          valor={ciclo ? segundosLegibles(ciclo.promedio) : '—'}
          detalle={
            ciclo
              ? t('tablero.kpi.rango', {
                  minimo: segundosLegibles(ciclo.minimo),
                  maximo: segundosLegibles(ciclo.maximo),
                })
              : t('tablero.kpi.sinCiclos')
          }
        />
        <Indicador
          titulo={t('tablero.kpi.carrera')}
          valor={carrera ? `${carrera.promedio.toFixed(2)} s` : '—'}
          detalle={
            carrera
              ? t('tablero.kpi.rango', {
                  minimo: `${carrera.minimo.toFixed(2)} s`,
                  maximo: `${carrera.maximo.toFixed(2)} s`,
                })
              : t('tablero.kpi.sinDato')
          }
        />
        <Indicador
          titulo={t('tablero.kpi.garraPiezas')}
          valor={String(garraAl + garraPl)}
          detalle={t('tablero.kpi.piezasDetalle', { al: garraAl, pl: garraPl })}
        />
        <Indicador
          titulo={t('tablero.kpi.cicloGarra')}
          valor={cicloGarra ? segundosLegibles(cicloGarra.promedio) : '—'}
          detalle={
            cicloGarra
              ? t('tablero.kpi.rango', {
                  minimo: segundosLegibles(cicloGarra.minimo),
                  maximo: segundosLegibles(cicloGarra.maximo),
                })
              : t('tablero.kpi.sinDato')
          }
        />
      </div>

      <LineaEstados estados={estados} tiempos={tiempos} ventana={ventana} />

      <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        <Tendencia
          titulo={t('tablero.tendencias.ciclo')}
          nota={t('tablero.tendencias.cicloNota')}
          puntos={ciclosPlc}
          decimales={1}
        />
        <Tendencia
          titulo={t('tablero.tendencias.carrera')}
          nota={t('tablero.tendencias.carreraNota')}
          puntos={carreras}
          decimales={2}
        />
        <Tendencia
          titulo={t('tablero.tendencias.garra')}
          nota={t('tablero.tendencias.garraNota')}
          puntos={ciclosGarra}
          decimales={1}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <GraficaPasos tiempos={tiempoPorValor(series.pasos, ventana)} />
        <TablaFallas fallas={fallas} />
      </div>
    </>
  )
}

const SUBTITULO = 'text-[15px] font-bold'

function Tarjeta({
  titulo,
  nota,
  extra,
  children,
}: {
  titulo: string
  nota?: string
  extra?: ReactNode
  children: ReactNode
}) {
  return (
    <section className={`${TARJETA} flex min-w-0 flex-col gap-3 p-4`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className={SUBTITULO}>{titulo}</h2>
          {nota && <p className="text-[12.5px] text-suave">{nota}</p>}
        </div>
        {extra}
      </div>
      {children}
    </section>
  )
}

function Indicador({
  titulo,
  valor,
  detalle,
  tono,
}: {
  titulo: string
  valor: string
  detalle?: string
  tono?: 'alerta'
}) {
  return (
    <div className={`${TARJETA} flex flex-col gap-1 p-4`}>
      <h2 className="text-[12px] font-bold tracking-wide text-suave uppercase">
        {titulo}
      </h2>
      <p
        className={`text-[28px] leading-tight font-bold tabular-nums ${tono === 'alerta' ? 'text-alerta' : ''}`}
      >
        {valor}
      </p>
      {detalle && (
        <p className="text-[12px] leading-snug text-suave">{detalle}</p>
      )}
    </div>
  )
}

// Color y textura de cada estado. Reset y falla llevan rayas para no depender solo del color.
const RAYAS =
  'repeating-linear-gradient(135deg, transparent 0 4px, rgb(0 0 0 / 0.28) 4px 7px)'
type EstadoTramo = 'marcha' | 'mantenimiento' | 'reset' | 'paro' | 'falla'
const ESTADOS: {
  valor: number
  estado: EstadoTramo
  clase: string
  rayas: boolean
}[] = [
  { valor: 1, estado: 'marcha', clase: 'bg-ok', rayas: false },
  { valor: 2, estado: 'mantenimiento', clase: 'bg-aviso', rayas: false },
  { valor: 4, estado: 'reset', clase: 'bg-aviso', rayas: true },
  { valor: 3, estado: 'paro', clase: 'bg-alerta/55', rayas: false },
  { valor: ESTADO_FALLA, estado: 'falla', clase: 'bg-alerta', rayas: true },
]
const estiloEstado = (valor: number) => ESTADOS.find((e) => e.valor === valor)

// El estado de la celda a lo largo de la ventana: una franja con un color por estado.
function LineaEstados({
  estados,
  tiempos,
  ventana,
}: {
  estados: Punto[]
  tiempos: Map<number, number>
  ventana: Ventana
}) {
  const { t } = useTranslation()
  const lista = tramos(estados, ventana)
  const largo = ventana.hasta - ventana.desde
  return (
    <Tarjeta titulo={t('tablero.estados.titulo')}>
      {lista.length === 0 ? (
        <p className="text-[13px] text-suave">{t('tablero.sinTorreta')}</p>
      ) : (
        <>
          <div className="relative h-9 overflow-hidden rounded-[4px] bg-linea/40">
            {lista.map((tramo) => {
              const estilo = estiloEstado(tramo.valor)
              return (
                <span
                  key={tramo.inicio}
                  title={`${t(`tablero.estadoCelda.${estilo?.estado ?? 'sinDato'}`)} · ${hora(tramo.inicio)}–${hora(tramo.fin)}`}
                  className={`absolute inset-y-0 border-r-2 border-panel ${estilo?.clase ?? 'bg-suave'}`}
                  style={{
                    left: `${((tramo.inicio - ventana.desde) / largo) * 100}%`,
                    width: `${((tramo.fin - tramo.inicio) / largo) * 100}%`,
                    backgroundImage: estilo?.rayas ? RAYAS : undefined,
                  }}
                />
              )
            })}
          </div>
          <div className="flex justify-between text-[11px] text-suave tabular-nums">
            <span>{hora(ventana.desde)}</span>
            <span>{hora(ventana.hasta)}</span>
          </div>
          <ul className="grid gap-x-6 gap-y-1.5 text-[12.5px] sm:grid-cols-3 lg:grid-cols-5">
            {ESTADOS.map(({ valor, estado, clase, rayas }) => (
              <li key={valor} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`h-3 w-3 shrink-0 rounded-[2px] ${clase}`}
                  style={{ backgroundImage: rayas ? RAYAS : undefined }}
                />
                <span className="text-suave">
                  {t(`tablero.estados.${estado}`)}
                </span>
                <span className="ml-auto font-bold tabular-nums">
                  {segundosLegibles(tiempos.get(valor) ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Tarjeta>
  )
}

// Un valor por ciclo (los más recientes), como lo mide el PLC.
function Tendencia({
  titulo,
  nota,
  puntos,
  decimales,
}: {
  titulo: string
  nota: string
  puntos: Punto[]
  decimales: number
}) {
  const { t } = useTranslation()
  const ultimos = puntos.slice(-PUNTOS_TENDENCIA)
  if (ultimos.length === 0)
    return (
      <Tarjeta titulo={titulo} nota={nota}>
        <p className="text-[13px] text-suave">{t('tablero.sinDatos')}</p>
      </Tarjeta>
    )
  const maximo = Math.max(...ultimos.map((p) => p.valor))
  const tope = maximo <= 1 ? 1 : Math.ceil(maximo * 1.15)
  const etiquetas = ultimos.map((p) => hora(Date.parse(p.ts)))
  return (
    <Tarjeta titulo={titulo} nota={nota}>
      <Linea
        etiquetas={etiquetas}
        valores={ultimos.map((p) => p.valor)}
        maximo={tope}
        arriba={`${tope} s`}
        alto={150}
        descripciones={ultimos.map(
          (p, i) => `${etiquetas[i]}: ${p.valor.toFixed(decimales)} s`,
        )}
      />
    </Tarjeta>
  )
}

// Cuánto tiempo pasó la celda en cada paso; un paso que se alarga se ve de inmediato.
function GraficaPasos({ tiempos }: { tiempos: Map<number, number> }) {
  const { t } = useTranslation()
  const maximo = Math.max(1, ...tiempos.values())
  return (
    <Tarjeta titulo={t('tablero.pasos.titulo')} nota={t('tablero.pasos.nota')}>
      {tiempos.size === 0 ? (
        <p className="text-[13px] text-suave">{t('tablero.sinDatos')}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {PASOS.map((paso) => {
            const segundos = tiempos.get(paso) ?? 0
            return (
              <li
                key={paso}
                className="grid grid-cols-[minmax(0,8rem)_1fr_4.5rem] items-center gap-2 text-[12.5px]"
              >
                <span className="truncate text-suave">
                  {nombrePaso(paso, t)}
                </span>
                <span className="h-3 rounded-r-[4px] bg-linea/40">
                  <span
                    className="block h-full rounded-r-[4px] bg-acento"
                    style={{ width: `${(segundos / maximo) * 100}%` }}
                  />
                </span>
                <span className="text-right font-bold tabular-nums">
                  {segundosLegibles(segundos)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Tarjeta>
  )
}

function TablaFallas({
  fallas,
}: {
  fallas: ReturnType<typeof fallasEnVentana>
}) {
  const { t } = useTranslation()
  const recientes = [...fallas].reverse().slice(0, 10)
  return (
    <Tarjeta titulo={t('tablero.fallas.titulo')}>
      {recientes.length === 0 ? (
        <p className="text-[13px] text-suave">{t('tablero.fallas.ninguna')}</p>
      ) : (
        <table className="w-full text-left text-[12.5px] tabular-nums">
          <thead className="text-suave">
            <tr>
              <th className="py-1.5 pr-3 font-semibold">
                {t('tablero.fallas.hora')}
              </th>
              <th className="py-1.5 pr-3 font-semibold">
                {t('tablero.fallas.codigo')}
              </th>
              <th className="py-1.5 font-semibold">
                {t('tablero.fallas.duracion')}
              </th>
            </tr>
          </thead>
          <tbody>
            {recientes.map((falla) => (
              <tr key={falla.inicio} className="border-t border-linea">
                <td className="py-1.5 pr-3">{hora(falla.inicio)}</td>
                <td className="py-1.5 pr-3 font-bold text-alerta">
                  {falla.codigo ?? '—'}
                </td>
                <td className="py-1.5">
                  {falla.fin === null
                    ? t('tablero.fallas.activa')
                    : segundosLegibles((falla.fin - falla.inicio) / 1000)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Tarjeta>
  )
}
