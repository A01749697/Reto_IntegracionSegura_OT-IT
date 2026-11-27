// Tablero de operación de la celda (S7-1516): la última hora, 8 h o 24 h sacadas del
// historian. Se actualiza solo cada 30 s.
//
// La ventana termina en la lectura más reciente de la celda, no en la hora del navegador:
// si la celda está apagada, se ve su última actividad en lugar de gráficas vacías.
import type { TFunction } from 'i18next'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { boton, TARJETA } from '../comun/estilos'
import Segmentos from '../comun/Segmentos'
import type {
  ResultadoHistorial,
  ResultadoLecturas,
} from '../gemelo/apiLecturas'
import { resumirLecturas, SEGUNDOS_ATRASO } from '../gemelo/enVivo'
import { estadoCelda, type EstadoCelda, type Valores } from '../gemelo/estado'
import { NODO, NODOS, PASOS, type NodoConocido } from '../gemelo/nodos'
import { BarrasApiladas, Leyenda, Linea } from '../indicadores/Graficas'
import MarcoPanel from '../panel/MarcoPanel'
import { fechaHora, hace, region } from '../panel/tiempo'
import {
  duracionesDeCiclo,
  ESTADO_FALLA,
  estadosDeLaCelda,
  fallasEnVentana,
  piezasPorTramo,
  resumir,
  segundosLegibles,
  tiempoPorValor,
  totalContador,
  tramos,
  valoresEnVentana,
  type Punto,
  type Ventana,
} from './calculos'

type Props = {
  obtenerLecturas: () => Promise<ResultadoLecturas>
  obtenerHistorial: (
    plc: string,
    variable: string,
    desde: Date,
    hasta: Date,
  ) => Promise<ResultadoHistorial>
  sesionCaducada: () => void
}

export type Rango = '1h' | '8h' | '24h'
const RANGOS: Rango[] = ['1h', '8h', '24h']
const SEGUNDOS_RANGO: Record<Rango, number> = {
  '1h': 3600,
  '8h': 8 * 3600,
  '24h': 24 * 3600,
}
// tramos de la gráfica de piezas: 5 min, 40 min o 2 h
const TRAMOS_PIEZAS = 12
// puntos de las tendencias (los más recientes)
const PUNTOS_TENDENCIA = 40
export const SEGUNDOS_ENTRE_CONSULTAS = 30

const SERIES = {
  aluminio: NODOS.piezasAluminio,
  otras: NODOS.piezasOtras,
  pasos: NODOS.paso,
  torreta: NODOS.torreta,
  falla: NODOS.falla,
  codFalla: NODOS.codFalla,
  tCiclo: NODOS.tCiclo,
  tCarrera: NODOS.tCarreraPd1,
} satisfies Record<string, NodoConocido>
type Serie = keyof typeof SERIES

type Datos = {
  ventana: Ventana
  ahora: Valores // último valor de cada nodo del S7-1516
  ultimaCelda: number | null
  atraso: number | null // segundos desde la última lectura, al consultar
  series: Record<Serie, Punto[]>
}

type Carga =
  | { estado: 'cargando' }
  | { estado: 'error' }
  | { estado: 'listo'; datos: Datos }

const hora = (instante: number) =>
  new Date(instante).toLocaleTimeString(region(), {
    hour: '2-digit',
    minute: '2-digit',
  })

const nombrePaso = (paso: number, t: TFunction) =>
  `${paso} · ${t(`gemelo.pasos.${paso}`, { defaultValue: '—' })}`

export default function PaginaTablero({
  obtenerLecturas,
  obtenerHistorial,
  sesionCaducada,
}: Props) {
  const { t } = useTranslation()
  const [rango, setRango] = useState<Rango>('1h')
  const [carga, setCarga] = useState<Carga>({ estado: 'cargando' })
  const [recarga, setRecarga] = useState(0)

  const cargar = useCallback(
    async (rango: Rango): Promise<Carga | 'sesion'> => {
      const resultado = await obtenerLecturas()
      if (!resultado.ok)
        return resultado.motivo === 'sesion' ? 'sesion' : { estado: 'error' }
      const lecturas = resumirLecturas(resultado.lecturas)
      const hasta = lecturas.ultimaTablero ?? Date.now()
      const largo = SEGUNDOS_RANGO[rango] * 1000
      const ventana = { desde: hasta - largo, hasta }
      // se pide desde una ventana antes, para saber cómo estaba todo al empezar
      const claves = Object.keys(SERIES) as Serie[]
      const historiales = await Promise.all(
        claves.map((clave) =>
          obtenerHistorial(
            SERIES[clave].plc,
            SERIES[clave].nodo,
            new Date(ventana.desde - largo),
            new Date(hasta + 1000),
          ),
        ),
      )
      if (historiales.some((h) => !h.ok && h.motivo === 'sesion'))
        return 'sesion'
      if (historiales.every((h) => !h.ok)) return { estado: 'error' }
      const series = Object.fromEntries(
        claves.map((clave, i) => {
          const h = historiales[i]
          return [clave, h.ok ? h.puntos : []]
        }),
      ) as Record<Serie, Punto[]>
      return {
        estado: 'listo',
        datos: {
          ventana,
          ahora: lecturas.tablero,
          ultimaCelda: lecturas.ultimaTablero,
          atraso:
            lecturas.ultimaTablero === null
              ? null
              : Math.max(0, Math.round((Date.now() - hasta) / 1000)),
          series,
        },
      }
    },
    [obtenerLecturas, obtenerHistorial],
  )

  useEffect(() => {
    let vigente = true
    const consultar = () =>
      cargar(rango).then((nueva) => {
        if (!vigente) return
        if (nueva === 'sesion') sesionCaducada()
        else setCarga(nueva)
      })
    consultar()
    const reloj = setInterval(consultar, SEGUNDOS_ENTRE_CONSULTAS * 1000)
    return () => {
      vigente = false
      clearInterval(reloj)
    }
  }, [cargar, rango, recarga, sesionCaducada])

  return (
    <MarcoPanel titulo={t('tablero.titulo')}>
      <div className="flex flex-wrap items-center gap-3">
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
        <button
          type="button"
          className={boton('neutro')}
          onClick={() => setRecarga((n) => n + 1)}
        >
          {t('tablero.actualizar')}
        </button>
        {carga.estado === 'listo' && (
          <span className="text-[13px] text-suave">
            {t('tablero.periodo', {
              desde: fechaHora(
                new Date(carga.datos.ventana.desde).toISOString(),
              ),
              hasta: fechaHora(
                new Date(carga.datos.ventana.hasta).toISOString(),
              ),
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
      {carga.estado === 'listo' && <Contenido datos={carga.datos} />}
    </MarcoPanel>
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

const LETRERO: Record<EstadoCelda, string> = {
  marcha: 'border-ok bg-ok/10 text-ok',
  mantenimiento: 'border-aviso bg-aviso/10 text-aviso',
  reset: 'border-aviso bg-aviso/10 text-aviso',
  paro: 'border-alerta bg-alerta/10 text-alerta',
  falla: 'border-alerta bg-alerta/15 text-alerta',
  sinDato: 'border-linea text-suave',
  sinComunicacion: 'border-linea text-suave',
}

function Ahora({ datos }: { datos: Datos }) {
  const { t } = useTranslation()
  const { ahora, atraso } = datos
  const quieta = atraso !== null && atraso > SEGUNDOS_ATRASO
  const estado = estadoCelda(ahora, false)
  const paso = ahora[NODO.paso]
  return (
    <section
      aria-label={t('tablero.ahora')}
      className={`${TARJETA} flex flex-wrap items-center gap-x-6 gap-y-2 p-4`}
    >
      <span
        className={`rounded-md border-2 px-3 py-1 text-[15px] font-bold tracking-wider ${LETRERO[estado]}`}
      >
        {t(`gemelo.estado.${estado}`)}
        {estado === 'falla' &&
          ` · ${t('gemelo.codigoFalla', { codigo: ahora[NODO.codFalla] ?? 0 })}`}
      </span>
      <span className="text-[13px] text-suave">
        {t('tablero.paso')}{' '}
        <span className="font-bold text-texto">
          {paso === undefined ? t('gemelo.sinDato') : nombrePaso(paso, t)}
        </span>
      </span>
      {datos.ultimaCelda === null ? (
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

function Contenido({ datos }: { datos: Datos }) {
  const { t } = useTranslation()
  const { ventana, series } = datos
  const aluminio = totalContador(series.aluminio, ventana)
  const plastico = totalContador(series.otras, ventana)
  const total = aluminio + plastico

  const estados = estadosDeLaCelda(series.torreta, series.falla)
  const tiempos = tiempoPorValor(estados, ventana)
  const marcha = tiempos.get(1) ?? 0
  const mantenimiento = tiempos.get(2) ?? 0
  const detenida =
    (tiempos.get(3) ?? 0) +
    (tiempos.get(4) ?? 0) +
    (tiempos.get(ESTADO_FALLA) ?? 0)
  const disponible = marcha + detenida

  // el tiempo de ciclo lo mide el PLC; si no llega, se calcula con los pasos
  const ciclosPlc = valoresEnVentana(series.tCiclo, ventana)
  const ciclo = resumir(
    ciclosPlc.length
      ? ciclosPlc.map((p) => p.valor)
      : duracionesDeCiclo(series.pasos, ventana),
  )
  const carreras = valoresEnVentana(series.tCarrera, ventana)
  const carrera = resumir(carreras.map((p) => p.valor))
  const fallas = fallasEnVentana(series.falla, series.codFalla, ventana)
  const ultimaFalla = fallas[fallas.length - 1]

  return (
    <>
      <Ahora datos={datos} />

      <section
        aria-label={t('tablero.indicadores')}
        className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
      >
        <Indicador
          titulo={t('tablero.kpi.piezas')}
          valor={String(total)}
          detalle={t('tablero.kpi.piezasDetalle', {
            al: aluminio,
            pl: plastico,
          })}
        />
        <Indicador
          titulo={t('tablero.kpi.disponibilidad')}
          valor={
            disponible > 0
              ? `${Math.round((marcha / disponible) * 100)} %`
              : '—'
          }
          detalle={t('tablero.kpi.disponibilidadDetalle', {
            tiempo: segundosLegibles(marcha),
          })}
        />
        <Indicador
          titulo={t('tablero.kpi.ciclo')}
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
          titulo={t('tablero.kpi.fallas')}
          valor={String(fallas.length)}
          tono={fallas.length > 0 ? 'alerta' : undefined}
          detalle={
            ultimaFalla
              ? t('tablero.kpi.ultimaFalla', {
                  codigo: ultimaFalla.codigo ?? '—',
                  hora: hora(ultimaFalla.inicio),
                })
              : t('tablero.kpi.sinFallas')
          }
        />
        <Indicador
          titulo={t('tablero.kpi.mantenimiento')}
          valor={segundosLegibles(mantenimiento)}
          detalle={t('tablero.kpi.mantenimientoDetalle')}
        />
      </section>

      <LineaEstados estados={estados} tiempos={tiempos} ventana={ventana} />

      <GraficaPiezas
        aluminio={series.aluminio}
        otras={series.otras}
        ventana={ventana}
      />

      <div className="grid gap-5 lg:grid-cols-2">
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
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <GraficaPasos tiempos={tiempoPorValor(series.pasos, ventana)} />
        <TablaFallas fallas={fallas} />
      </div>
    </>
  )
}

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
                  title={`${t(`gemelo.estado.${estilo?.estado ?? 'sinDato'}`)} · ${hora(tramo.inicio)}–${hora(tramo.fin)}`}
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

function GraficaPiezas({
  aluminio,
  otras,
  ventana,
}: {
  aluminio: Punto[]
  otras: Punto[]
  ventana: Ventana
}) {
  const { t } = useTranslation()
  const cubetas = piezasPorTramo(aluminio, otras, ventana, TRAMOS_PIEZAS)
  const etiquetas = cubetas.map((c) => hora(c.inicio))
  return (
    <Tarjeta
      titulo={t('tablero.piezas.titulo')}
      extra={
        <Leyenda
          series={[
            ['bg-serie-al', t('tablero.aluminio')],
            ['bg-serie-pl', t('tablero.plastico')],
          ]}
        />
      }
    >
      <BarrasApiladas
        etiquetas={etiquetas}
        descripciones={cubetas.map((c) =>
          t('tablero.piezas.detalle', {
            tramo: `${hora(c.inicio)}–${hora(c.fin)}`,
            al: c.al,
            pl: c.pl,
            total: c.al + c.pl,
          }),
        )}
        series={[
          { clase: 'bg-serie-al', valores: cubetas.map((c) => c.al) },
          { clase: 'bg-serie-pl', valores: cubetas.map((c) => c.pl) },
        ]}
      />
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
