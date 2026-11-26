// Tablero de la celda: lo que produjo el S7-1516 en la última hora, 8 h o 24 h, sacado del
// historian. Es de solo lectura y se actualiza solo cada 30 s.
//
// La ventana termina en la lectura más reciente de la celda, no en la hora del navegador:
// si la celda está apagada, se ve su última actividad en lugar de gráficas vacías.
import type { TFunction } from 'i18next'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { boton, TARJETA } from '../comun/estilos'
import Segmentos from '../comun/Segmentos'
import type {
  ResultadoHistorial,
  ResultadoLecturas,
} from '../gemelo/apiLecturas'
import {
  colorTorreta,
  resumirLecturas,
  SEGUNDOS_ATRASO,
  type ColorTorreta,
  type LecturasCelda,
} from '../gemelo/enVivo'
import { ESTADOS_TORRETA, NODOS, type NodoConocido } from '../gemelo/nodos'
import MarcoPanel from '../panel/MarcoPanel'
import { fechaHora, hace, region } from '../panel/tiempo'
import {
  duracionesDeCiclo,
  piezasPorTramo,
  resumir,
  segundosLegibles,
  tiempoPorValor,
  totalContador,
  tramos,
  type Cubeta,
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
export const SEGUNDOS_ENTRE_CONSULTAS = 30
const PASOS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

type Datos = {
  ventana: Ventana
  lecturas: LecturasCelda
  ultimaCelda: string | null // lectura más reciente del S7-1516
  atraso: number | null // segundos desde esa lectura, al consultar
  aluminio: Punto[]
  otras: Punto[]
  pasos: Punto[]
  torreta: Punto[]
}

type Carga =
  | { estado: 'cargando' }
  | { estado: 'error' }
  | { estado: 'listo'; datos: Datos }

// La lectura más reciente de la celda (S7-1516), que marca el final de la ventana.
function ultimaDeLaCelda(lecturas: LecturasCelda): string | null {
  let ultima: string | null = null
  for (const { ts } of lecturas.estaciones['S7-1500'])
    if (ultima === null || Date.parse(ts) > Date.parse(ultima)) ultima = ts
  return ultima
}

const hora = (instante: number) =>
  new Date(instante).toLocaleTimeString(region(), {
    hour: '2-digit',
    minute: '2-digit',
  })

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
      const ultimaCelda = ultimaDeLaCelda(lecturas)
      const hasta = ultimaCelda ? Date.parse(ultimaCelda) : Date.now()
      const largo = SEGUNDOS_RANGO[rango] * 1000
      const ventana = { desde: hasta - largo, hasta }
      // se pide desde una ventana antes, para saber cómo estaba todo al empezar
      const pedir = (nodo: NodoConocido) =>
        obtenerHistorial(
          nodo.plc,
          nodo.nodo,
          new Date(ventana.desde - largo),
          new Date(hasta + 1000),
        )
      const historiales = await Promise.all([
        pedir(NODOS.piezasAluminio),
        pedir(NODOS.piezasOtras),
        pedir(NODOS.paso),
        pedir(NODOS.torreta),
      ])
      if (historiales.some((h) => !h.ok && h.motivo === 'sesion'))
        return 'sesion'
      const puntos = historiales.map((h) => (h.ok ? h.puntos : []))
      if (historiales.every((h) => !h.ok)) return { estado: 'error' }
      return {
        estado: 'listo',
        datos: {
          ventana,
          lecturas,
          ultimaCelda,
          atraso: ultimaCelda
            ? Math.max(0, Math.round((Date.now() - hasta) / 1000))
            : null,
          aluminio: puntos[0],
          otras: puntos[1],
          pasos: puntos[2],
          torreta: puntos[3],
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

function Contenido({ datos }: { datos: Datos }) {
  const { t } = useTranslation()
  const { ventana, lecturas, ultimaCelda, atraso } = datos
  const aluminio = totalContador(datos.aluminio, ventana)
  const plastico = totalContador(datos.otras, ventana)
  const total = aluminio + plastico
  const ciclos = resumir(duracionesDeCiclo(datos.pasos, ventana))
  const torreta = tiempoPorValor(datos.torreta, ventana)
  let conocido = 0
  for (const segundos of torreta.values()) conocido += segundos
  const enMarcha = torreta.get(1) ?? 0

  return (
    <>
      <p className="-mt-2 text-[13px] text-suave">
        {t('tablero.periodo', {
          desde: fechaHora(new Date(ventana.desde).toISOString()),
          hasta: fechaHora(new Date(ventana.hasta).toISOString()),
        })}
      </p>
      {ultimaCelda === null ? (
        <p role="status" className={AVISO}>
          {t('tablero.sinLecturas')}
        </p>
      ) : (
        atraso !== null &&
        atraso > SEGUNDOS_ATRASO && (
          <p role="status" className={AVISO}>
            {t('tablero.celdaQuieta', { hace: hace(atraso) })}
          </p>
        )
      )}

      <section
        aria-label={t('tablero.indicadores')}
        className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
      >
        <Indicador
          titulo={t('tablero.piezas')}
          valor={String(total)}
          detalle={
            total > 0
              ? t('tablero.piezasDetalle', {
                  al: Math.round((aluminio / total) * 100),
                  pl: Math.round((plastico / total) * 100),
                })
              : t('tablero.sinPiezas')
          }
        />
        <Indicador
          titulo={t('tablero.aluminio')}
          valor={String(aluminio)}
          muestra="bg-serie-al"
        />
        <Indicador
          titulo={t('tablero.plastico')}
          valor={String(plastico)}
          muestra="bg-serie-pl"
        />
        <Indicador
          titulo={t('tablero.ciclo')}
          valor={ciclos ? segundosLegibles(ciclos.promedio) : '—'}
          detalle={
            ciclos
              ? t('tablero.cicloDetalle', {
                  minimo: segundosLegibles(ciclos.minimo),
                  maximo: segundosLegibles(ciclos.maximo),
                })
              : t('tablero.sinCiclos')
          }
        />
        <Indicador
          titulo={t('tablero.enMarcha')}
          valor={
            conocido > 0 ? `${Math.round((enMarcha / conocido) * 100)} %` : '—'
          }
          detalle={
            conocido > 0
              ? t('tablero.enMarchaDetalle', {
                  tiempo: segundosLegibles(enMarcha),
                })
              : t('tablero.sinTorreta')
          }
        />
        <Ahora lecturas={lecturas} />
      </section>

      <GraficaPiezas
        cubetas={piezasPorTramo(
          datos.aluminio,
          datos.otras,
          ventana,
          TRAMOS_PIEZAS,
        )}
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <GraficaPasos tiempos={tiempoPorValor(datos.pasos, ventana)} />
        <LineaTorreta puntos={datos.torreta} ventana={ventana} />
      </div>
    </>
  )
}

const AVISO =
  'rounded-lg border border-alerta/50 bg-alerta/10 px-3.5 py-2.5 text-[13px] leading-snug text-alerta'
const SUBTITULO = 'text-[15px] font-bold'

function Indicador({
  titulo,
  valor,
  detalle,
  muestra,
}: {
  titulo: string
  valor: string
  detalle?: string
  muestra?: string
}) {
  return (
    <div className={`${TARJETA} flex flex-col gap-1 p-4`}>
      <h2 className="flex items-center gap-2 text-[12px] font-bold tracking-wide text-suave uppercase">
        {muestra && (
          <span
            aria-hidden="true"
            className={`h-2.5 w-2.5 rounded-[2px] ${muestra}`}
          />
        )}
        {titulo}
      </h2>
      <p className="text-[28px] leading-tight font-bold tabular-nums">
        {valor}
      </p>
      {detalle && (
        <p className="text-[12px] leading-snug text-suave">{detalle}</p>
      )}
    </div>
  )
}

const FONDO_TORRETA: Record<ColorTorreta, string> = {
  verde: 'bg-ok',
  amarilla: 'bg-aviso',
  roja: 'bg-alerta',
  otro: 'bg-suave',
}

function textoTorreta(valor: number, t: TFunction): string {
  const color = colorTorreta(valor)
  if (color === null || color === 'otro')
    return t('gemelo.lecturas.torretaOtro', { valor })
  return t(`gemelo.lecturas.torreta_${color}`)
}

const nombrePaso = (paso: number, t: TFunction) =>
  t('gemelo.lecturas.pasoValor', {
    paso,
    nombre: t(`gemelo.pasosReales.${paso}`, { defaultValue: '—' }),
  })

function Ahora({ lecturas }: { lecturas: LecturasCelda }) {
  const { t } = useTranslation()
  const color = colorTorreta(lecturas.torreta)
  return (
    <div className={`${TARJETA} flex flex-col gap-1.5 p-4`}>
      <h2 className="text-[12px] font-bold tracking-wide text-suave uppercase">
        {t('tablero.ahora')}
      </h2>
      <p className="flex items-center gap-2 text-[14px] font-bold">
        {color && (
          <span
            aria-hidden="true"
            className={`h-3 w-3 rounded-full ${FONDO_TORRETA[color]}`}
          />
        )}
        {lecturas.torreta === null
          ? t('gemelo.lecturas.sinDato')
          : textoTorreta(lecturas.torreta, t)}
      </p>
      <p className="text-[12.5px] text-suave">
        {t('tablero.pasoActual')}{' '}
        <span className="font-bold text-texto">
          {lecturas.paso === null
            ? t('gemelo.lecturas.sinDato')
            : nombrePaso(lecturas.paso, t)}
        </span>
      </p>
    </div>
  )
}

function Leyenda({ series }: { series: [string, string][] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-suave">
      {series.map(([clase, texto]) => (
        <li key={texto} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`h-2.5 w-2.5 rounded-[2px] ${clase}`}
          />
          {texto}
        </li>
      ))}
    </ul>
  )
}

// Piezas por tramo: barras apiladas de aluminio y plástico, con el detalle al pasar encima.
function GraficaPiezas({ cubetas }: { cubetas: Cubeta[] }) {
  const { t } = useTranslation()
  const [activa, setActiva] = useState<number | null>(null)
  const maximo = Math.max(1, ...cubetas.map((c) => c.al + c.pl))
  const tramo = (c: Cubeta) => `${hora(c.inicio)}–${hora(c.fin)}`
  const detalle = (c: Cubeta) =>
    t('tablero.graficaPiezas.detalle', {
      tramo: tramo(c),
      al: c.al,
      pl: c.pl,
      total: c.al + c.pl,
    })
  const marcas = [0, Math.round(cubetas.length / 2), cubetas.length - 1]

  return (
    <section className={`${TARJETA} flex flex-col gap-3 p-4`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className={SUBTITULO}>{t('tablero.graficaPiezas.titulo')}</h2>
        <Leyenda
          series={[
            ['bg-serie-al', t('tablero.aluminio')],
            ['bg-serie-pl', t('tablero.plastico')],
          ]}
        />
      </div>
      <div className="flex gap-2">
        <div className="flex h-48 flex-col justify-between text-right text-[11px] text-suave tabular-nums">
          <span>{maximo}</span>
          <span>0</span>
        </div>
        <div className="relative flex-1">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 border-t border-dashed border-linea"
          />
          <div
            className="flex h-48 items-end gap-[2px] border-b border-linea"
            onMouseLeave={() => setActiva(null)}
          >
            {cubetas.map((c, i) => (
              <button
                key={c.inicio}
                type="button"
                aria-label={detalle(c)}
                onMouseEnter={() => setActiva(i)}
                onFocus={() => setActiva(i)}
                onBlur={() => setActiva(null)}
                className="flex h-full flex-1 cursor-default flex-col justify-end gap-[2px] rounded-t-[4px] focus-visible:ring-2 focus-visible:ring-acento/45 focus-visible:outline-none"
              >
                {c.pl > 0 && (
                  <span
                    className="w-full rounded-t-[4px] bg-serie-pl"
                    style={{ height: `${(c.pl / maximo) * 100}%` }}
                  />
                )}
                {c.al > 0 && (
                  <span
                    className={`w-full bg-serie-al ${c.pl > 0 ? '' : 'rounded-t-[4px]'}`}
                    style={{ height: `${(c.al / maximo) * 100}%` }}
                  />
                )}
              </button>
            ))}
          </div>
          {activa !== null && (
            <div
              role="tooltip"
              className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 -translate-y-full rounded-md border border-linea bg-fondo px-2.5 py-1.5 text-[12px] whitespace-nowrap shadow-lg"
              style={{
                left: `${((activa + 0.5) / cubetas.length) * 100}%`,
              }}
            >
              <p className="font-bold">{tramo(cubetas[activa])}</p>
              <p className="text-suave">
                {t('tablero.aluminio')}:{' '}
                <span className="font-bold text-texto">
                  {cubetas[activa].al}
                </span>
                {' · '}
                {t('tablero.plastico')}:{' '}
                <span className="font-bold text-texto">
                  {cubetas[activa].pl}
                </span>
              </p>
            </div>
          )}
          <div className="relative mt-1 h-4 text-[11px] text-suave tabular-nums">
            {marcas.map((i) => (
              <span
                key={i}
                className="absolute -translate-x-1/2"
                style={{ left: `${((i + 0.5) / cubetas.length) * 100}%` }}
              >
                {hora(cubetas[i].inicio)}
              </span>
            ))}
          </div>
        </div>
      </div>
      <details className="text-[12.5px]">
        <summary className="cursor-pointer text-suave">
          {t('tablero.verTabla')}
        </summary>
        <table className="mt-2 w-full text-left tabular-nums">
          <thead className="text-suave">
            <tr>
              <th className="py-1 font-semibold">
                {t('tablero.graficaPiezas.tramo')}
              </th>
              <th className="py-1 font-semibold">{t('tablero.aluminio')}</th>
              <th className="py-1 font-semibold">{t('tablero.plastico')}</th>
              <th className="py-1 font-semibold">{t('tablero.piezas')}</th>
            </tr>
          </thead>
          <tbody>
            {cubetas.map((c) => (
              <tr key={c.inicio} className="border-t border-linea">
                <td className="py-1">{tramo(c)}</td>
                <td className="py-1">{c.al}</td>
                <td className="py-1">{c.pl}</td>
                <td className="py-1 font-bold">{c.al + c.pl}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  )
}

// Cuánto tiempo pasó la celda en cada paso. Un paso que se alarga (como el 8 cuando se
// desajusta el final de carrera) se ve de inmediato.
function GraficaPasos({ tiempos }: { tiempos: Map<number, number> }) {
  const { t } = useTranslation()
  const maximo = Math.max(1, ...tiempos.values())
  return (
    <section className={`${TARJETA} flex flex-col gap-3 p-4`}>
      <div>
        <h2 className={SUBTITULO}>{t('tablero.graficaPasos.titulo')}</h2>
        <p className="text-[12.5px] text-suave">
          {t('tablero.graficaPasos.nota')}
        </p>
      </div>
      {tiempos.size === 0 ? (
        <p className="text-[13px] text-suave">{t('tablero.sinPasos')}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {PASOS.map((paso) => {
            const segundos = tiempos.get(paso) ?? 0
            return (
              <li
                key={paso}
                className="grid grid-cols-[minmax(0,10rem)_1fr_4.5rem] items-center gap-2 text-[12.5px]"
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
    </section>
  )
}

// La torreta a lo largo de la ventana: una franja con un color por estado.
function LineaTorreta({
  puntos,
  ventana,
}: {
  puntos: Punto[]
  ventana: Ventana
}) {
  const { t } = useTranslation()
  const lista = tramos(puntos, ventana)
  const largo = ventana.hasta - ventana.desde
  const tiempos = tiempoPorValor(puntos, ventana)
  const presentes = (['verde', 'amarilla', 'roja'] as const).filter((color) =>
    lista.some((tramo) => colorTorreta(tramo.valor) === color),
  )
  return (
    <section className={`${TARJETA} flex flex-col gap-3 p-4`}>
      <div>
        <h2 className={SUBTITULO}>{t('tablero.torreta.titulo')}</h2>
        <p className="text-[12.5px] text-suave">{t('tablero.torreta.nota')}</p>
      </div>
      {lista.length === 0 ? (
        <p className="text-[13px] text-suave">{t('tablero.sinTorreta')}</p>
      ) : (
        <>
          <div className="relative h-8 overflow-hidden rounded-[4px] bg-linea/40">
            {lista.map((tramo) => {
              const color = colorTorreta(tramo.valor) ?? 'otro'
              return (
                <span
                  key={tramo.inicio}
                  title={`${textoTorreta(tramo.valor, t)} · ${hora(tramo.inicio)}–${hora(tramo.fin)}`}
                  className={`absolute inset-y-0 border-r-2 border-panel ${FONDO_TORRETA[color]}`}
                  style={{
                    left: `${((tramo.inicio - ventana.desde) / largo) * 100}%`,
                    width: `${((tramo.fin - tramo.inicio) / largo) * 100}%`,
                  }}
                />
              )
            })}
          </div>
          <div className="flex justify-between text-[11px] text-suave tabular-nums">
            <span>{hora(ventana.desde)}</span>
            <span>{hora(ventana.hasta)}</span>
          </div>
          <ul className="flex flex-col gap-1 text-[12.5px]">
            {presentes.map((color) => (
              <li key={color} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`h-2.5 w-2.5 rounded-full ${FONDO_TORRETA[color]}`}
                />
                <span className="flex-1 text-suave">
                  {t(`gemelo.lecturas.torreta_${color}`)}
                </span>
                <span className="font-bold tabular-nums">
                  {segundosLegibles(tiempos.get(ESTADOS_TORRETA[color]) ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
