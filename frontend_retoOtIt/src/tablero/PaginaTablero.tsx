// Tablero de la celda, todo en una pantalla:
//   1. Cómo está la celda ahora (torreta, falla, paso).
//   2. El periodo (hoy, 7 o 30 días) contra el anterior: producción, disponibilidad, ritmo,
//      ciclo, paros y fallas. Lo calcula el panel con todo el historian (/lecturas/indicadores).
//   3. La operación reciente (1, 8 o 24 h): estado de la celda, tiempos que mide el PLC,
//      pasos, fallas y lo que clasifica la garra (ver Operacion.tsx).
//   4. El detalle por tramo, para descargar.
import type { TFunction } from 'i18next'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { boton, TARJETA } from '../comun/estilos'
import Segmentos from '../comun/Segmentos'
import MarcoPanel from '../panel/MarcoPanel'
import { region } from '../panel/tiempo'
import type { ResultadoLecturas } from '../gemelo/apiLecturas'
import type {
  Cubeta,
  EventoFalla,
  ResultadoIndicadores,
  Tramo,
} from '../indicadores/apiIndicadores'
import { BarrasApiladas, Leyenda, Linea } from '../indicadores/Graficas'
import {
  cambioEnPuntos,
  cambioRelativo,
  cicloPromedio,
  csvDeTramos,
  disponibilidad,
  fallasPorCodigo,
  piezasPorHora,
  sumar,
  ventanas,
  type Periodo,
  type Totales,
} from '../indicadores/resumen'
import { leerLecturas, type Lecturas } from './lecturas'
import { Ahora, Operacion, type ObtenerHistorial } from './Operacion'

type Props = {
  obtener: (
    desde: Date,
    hasta: Date,
    cubeta: Cubeta,
  ) => Promise<ResultadoIndicadores>
  obtenerLecturas: () => Promise<ResultadoLecturas>
  obtenerHistorial: ObtenerHistorial
  descargar: (nombre: string, contenido: Blob) => void
  sesionCaducada: () => void
  ahora?: () => Date
}

const PERIODOS: Periodo[] = ['hoy', '7d', '30d']
const SEGUNDOS_ENTRE_CONSULTAS = 60

type Datos = {
  periodo: Periodo
  actual: Tramo[]
  anterior: Tramo[]
  fallas: EventoFalla[]
  truncado: boolean
}

type Carga =
  | { estado: 'cargando' }
  | { estado: 'error' }
  | { estado: 'listo'; datos: Datos }

const numero = (valor: number, decimales = 0) =>
  valor.toLocaleString(region(), {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })

const horas = (segundos: number) =>
  `${numero(segundos / 3600, segundos < 36000 ? 1 : 0)} h`

const segundosCiclo = (segundos: number) =>
  segundos < 60
    ? `${numero(segundos, 1)} s`
    : `${Math.floor(segundos / 60)} min ${Math.round(segundos % 60)} s`

function etiquetaTramo(inicio: string, cubeta: Cubeta): string {
  const fecha = new Date(inicio)
  return cubeta === 'hora'
    ? fecha.toLocaleTimeString(region(), { hour: '2-digit', minute: '2-digit' })
    : fecha.toLocaleDateString(region(), { day: 'numeric', month: 'short' })
}

export default function PaginaTablero({
  obtener,
  obtenerLecturas,
  obtenerHistorial,
  descargar,
  sesionCaducada,
  ahora = () => new Date(),
}: Props) {
  const { t } = useTranslation()
  const [periodo, setPeriodo] = useState<Periodo>('hoy')
  const [lecturas, setLecturas] = useState<Lecturas | null>(null)
  const [carga, setCarga] = useState<Carga>({ estado: 'cargando' })
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let vigente = true
    const consultar = async () => {
      // cómo está la celda ahora; también marca el final de la operación reciente
      obtenerLecturas().then((resultado) => {
        if (!vigente) return
        if (resultado.ok) setLecturas(leerLecturas(resultado.lecturas))
        else if (resultado.motivo === 'sesion') sesionCaducada()
      })
      const { actual, anterior } = ventanas(periodo, ahora())
      const [a, b] = await Promise.all([
        obtener(actual.desde, actual.hasta, actual.cubeta),
        obtener(anterior.desde, anterior.hasta, anterior.cubeta),
      ])
      if (!vigente) return
      if (
        (!a.ok && a.motivo === 'sesion') ||
        (!b.ok && b.motivo === 'sesion')
      ) {
        sesionCaducada()
        return
      }
      if (!a.ok) {
        setCarga({ estado: 'error' })
        return
      }
      setCarga({
        estado: 'listo',
        datos: {
          periodo,
          actual: a.tramos,
          anterior: b.ok ? b.tramos : [],
          fallas: a.fallas,
          truncado: a.truncado,
        },
      })
    }
    consultar()
    const reloj = setInterval(consultar, SEGUNDOS_ENTRE_CONSULTAS * 1000)
    return () => {
      vigente = false
      clearInterval(reloj)
    }
    // ahora solo se usa al consultar; cambiarlo no pide otra consulta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obtener, obtenerLecturas, periodo, recarga, sesionCaducada])

  const datos = carga.estado === 'listo' ? carga.datos : null

  function exportar() {
    if (!datos) return
    const contenido = csvDeTramos(datos.actual, [
      t('indicadores.csv.inicio'),
      t('indicadores.csv.aluminio'),
      t('indicadores.csv.plastico'),
      t('indicadores.csv.piezas'),
      t('indicadores.csv.horasMarcha'),
      t('indicadores.csv.horasMantenimiento'),
      t('indicadores.csv.horasParo'),
      t('indicadores.csv.horasSinRegistro'),
      t('indicadores.csv.disponibilidad'),
      t('indicadores.csv.paros'),
      t('indicadores.csv.fallas'),
      t('indicadores.csv.ciclos'),
      t('indicadores.csv.ciclo'),
    ])
    descargar(
      `indicadores-${datos.periodo}-${ahora().toISOString().slice(0, 10)}.csv`,
      new Blob([contenido], { type: 'text/csv;charset=utf-8' }),
    )
  }

  return (
    <MarcoPanel titulo={t('tablero.titulo')}>
      <div className="flex flex-wrap items-center gap-3">
        <Segmentos
          etiqueta={t('indicadores.periodo')}
          opciones={PERIODOS.map((valor) => ({
            valor,
            texto: t(`indicadores.periodos.${valor}`),
          }))}
          valor={periodo}
          alCambiar={(valor) => {
            setCarga({ estado: 'cargando' })
            setPeriodo(valor)
          }}
        />
        <button
          type="button"
          className={boton('neutro')}
          onClick={() => setRecarga((n) => n + 1)}
        >
          {t('indicadores.actualizar')}
        </button>
        <button
          type="button"
          className={boton('contorno')}
          onClick={exportar}
          disabled={!datos}
        >
          {t('indicadores.descargar')}
        </button>
      </div>
      {carga.estado === 'cargando' && (
        <p role="status" className="text-suave">
          {t('general.cargando')}
        </p>
      )}
      {carga.estado === 'error' && (
        <p role="alert" className="text-alerta">
          {t('indicadores.error')}
        </p>
      )}
      {lecturas && <Ahora lecturas={lecturas} />}
      {datos && (
        <Contenido
          datos={datos}
          operacion={
            <Operacion
              lecturas={lecturas}
              obtenerHistorial={obtenerHistorial}
              sesionCaducada={sesionCaducada}
              recarga={recarga}
            />
          }
        />
      )}
    </MarcoPanel>
  )
}

type Tendencia = 'sube' | 'baja' | 'igual'

function Indicador({
  titulo,
  valor,
  cambio,
  mejorSiSube = true,
  detalle,
}: {
  titulo: string
  valor: string
  cambio?: { texto: string; valor: number } | null
  mejorSiSube?: boolean | null // null: ni mejor ni peor (la mezcla)
  detalle?: string
}) {
  const { t } = useTranslation()
  const tendencia: Tendencia | null = cambio
    ? Math.abs(cambio.valor) < 0.05
      ? 'igual'
      : cambio.valor > 0
        ? 'sube'
        : 'baja'
    : null
  const bueno =
    tendencia === null || tendencia === 'igual' || mejorSiSube === null
      ? null
      : (tendencia === 'sube') === mejorSiSube
  const flecha = { sube: '▲', baja: '▼', igual: '■' }
  return (
    <div className={`${TARJETA} flex flex-col gap-1 p-4`}>
      <h2 className="text-[12px] font-bold tracking-wide text-suave uppercase">
        {titulo}
      </h2>
      <p className="text-[28px] leading-tight font-bold tabular-nums">
        {valor}
      </p>
      {cambio && tendencia && (
        <p
          className={`text-[12.5px] font-semibold tabular-nums ${
            bueno === null ? 'text-suave' : bueno ? 'text-ok' : 'text-alerta'
          }`}
        >
          <span aria-hidden="true">{flecha[tendencia]} </span>
          {cambio.texto}{' '}
          <span className="font-normal text-suave">
            {t('indicadores.contraAnterior')}
          </span>
        </p>
      )}
      {detalle && (
        <p className="text-[12px] leading-snug text-suave">{detalle}</p>
      )}
    </div>
  )
}

const conSigno = (valor: number, decimales = 0) =>
  `${valor > 0 ? '+' : valor < 0 ? '−' : ''}${numero(Math.abs(valor), decimales)}`

function porcentajeCambio(
  actual: number | null,
  anterior: number | null,
): { texto: string; valor: number } | null {
  const c = cambioRelativo(actual, anterior)
  return c === null ? null : { texto: `${conSigno(c)} %`, valor: c }
}

function puntosCambio(
  actual: number | null,
  anterior: number | null,
  t: TFunction,
): { texto: string; valor: number } | null {
  const c = cambioEnPuntos(actual, anterior)
  return c === null
    ? null
    : {
        texto: t('indicadores.puntos', { valor: conSigno(c, 1) }),
        valor: c,
      }
}

function Contenido({
  datos,
  operacion,
}: {
  datos: Datos
  operacion: ReactNode
}) {
  const { t } = useTranslation()
  const cubeta: Cubeta = datos.periodo === 'hoy' ? 'hora' : 'dia'
  const total = sumar(datos.actual)
  const antes = sumar(datos.anterior)
  const hayAntes = datos.anterior.length > 0
  const comparar = <T,>(f: (x: Totales) => T | null) =>
    hayAntes ? f(antes) : null

  const disp = disponibilidad(total)
  const ritmo = piezasPorHora(total)
  const ciclo = cicloPromedio(total)
  const etiquetas = datos.actual.map((tramo) =>
    etiquetaTramo(tramo.inicio, cubeta),
  )
  const tiempoTotal =
    total.marcha + total.mantenimiento + total.paro + total.sinRegistro

  return (
    <>
      {datos.truncado && (
        <p role="status" className="text-[13px] text-alerta">
          {t('indicadores.truncado')}
        </p>
      )}
      {total.marcha + total.paro + total.mantenimiento === 0 && (
        <p
          role="status"
          className="rounded-lg border border-linea bg-panel px-3.5 py-2.5 text-[13px] text-suave"
        >
          {t('indicadores.sinActividad')}
        </p>
      )}

      <section
        aria-label={t('indicadores.resumen')}
        className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
      >
        <Indicador
          titulo={t('indicadores.kpi.produccion')}
          valor={numero(total.piezas)}
          cambio={porcentajeCambio(
            total.piezas,
            comparar((x) => x.piezas),
          )}
          detalle={t('indicadores.kpi.produccionDetalle', {
            al: numero(total.aluminio),
            pl: numero(total.plastico),
          })}
        />
        <Indicador
          titulo={t('indicadores.kpi.disponibilidad')}
          valor={disp === null ? '—' : `${numero(disp, 1)} %`}
          cambio={puntosCambio(disp, comparar(disponibilidad), t)}
          detalle={t('indicadores.kpi.disponibilidadDetalle', {
            marcha: horas(total.marcha),
          })}
        />
        <Indicador
          titulo={t('indicadores.kpi.ritmo')}
          valor={ritmo === null ? '—' : numero(ritmo, 1)}
          cambio={porcentajeCambio(ritmo, comparar(piezasPorHora))}
          detalle={t('indicadores.kpi.ritmoDetalle')}
        />
        <Indicador
          titulo={t('indicadores.kpi.ciclo')}
          valor={ciclo === null ? '—' : segundosCiclo(ciclo)}
          cambio={porcentajeCambio(ciclo, comparar(cicloPromedio))}
          mejorSiSube={false}
          detalle={t('indicadores.kpi.cicloDetalle', {
            ciclos: numero(total.ciclos),
          })}
        />
        <Indicador
          titulo={t('indicadores.kpi.paros')}
          valor={numero(total.paros)}
          cambio={porcentajeCambio(
            total.paros,
            comparar((x) => x.paros),
          )}
          mejorSiSube={false}
          detalle={t('indicadores.kpi.parosDetalle', {
            tiempo: horas(total.paro),
          })}
        />
        <Indicador
          titulo={t('indicadores.kpi.fallas')}
          valor={numero(total.fallas)}
          cambio={porcentajeCambio(
            total.fallas,
            comparar((x) => x.fallas),
          )}
          mejorSiSube={false}
          detalle={t('indicadores.kpi.fallasDetalle', {
            tiempo: horas(total.mantenimiento),
          })}
        />
      </section>

      <Tarjeta
        titulo={t(`indicadores.produccion.titulo_${cubeta}`)}
        extra={
          <Leyenda
            series={[
              ['bg-serie-al', t('indicadores.aluminio')],
              ['bg-serie-pl', t('indicadores.plastico')],
            ]}
          />
        }
      >
        <BarrasApiladas
          etiquetas={etiquetas}
          descripciones={datos.actual.map((tramo, i) =>
            t('indicadores.produccion.detalle', {
              tramo: etiquetas[i],
              al: tramo.aluminio,
              pl: tramo.plastico,
              total: tramo.aluminio + tramo.plastico,
            }),
          )}
          series={[
            {
              clase: 'bg-serie-al',
              valores: datos.actual.map((x) => x.aluminio),
            },
            {
              clase: 'bg-serie-pl',
              valores: datos.actual.map((x) => x.plastico),
            },
          ]}
        />
      </Tarjeta>

      <div className="grid gap-5 lg:grid-cols-2">
        <Tarjeta
          titulo={t(`indicadores.disponibilidad.titulo_${cubeta}`)}
          nota={t('indicadores.disponibilidad.nota')}
        >
          <BarrasApiladas
            etiquetas={etiquetas}
            descripciones={datos.actual.map((tramo, i) => {
              const d = disponibilidad(tramo)
              return d === null
                ? t('indicadores.disponibilidad.sinDatos', {
                    tramo: etiquetas[i],
                  })
                : t('indicadores.disponibilidad.detalle', {
                    tramo: etiquetas[i],
                    valor: numero(d, 1),
                    marcha: horas(tramo.marcha),
                    paro: horas(tramo.paro),
                  })
            })}
            tope={100}
            unidad=" %"
            series={[
              {
                clase: 'bg-acento',
                valores: datos.actual.map((x) => disponibilidad(x) ?? 0),
              },
            ]}
          />
        </Tarjeta>
        <Tarjeta
          titulo={t('indicadores.ciclo.titulo')}
          nota={t('indicadores.ciclo.nota')}
        >
          <CicloPorTramo tramos={datos.actual} etiquetas={etiquetas} />
        </Tarjeta>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Tarjeta
          titulo={t('indicadores.tiempo.titulo')}
          nota={t('indicadores.tiempo.nota')}
        >
          <UsoDelTiempo total={total} tiempoTotal={tiempoTotal} />
        </Tarjeta>
        <Tarjeta
          titulo={t('indicadores.fallas.titulo')}
          nota={t('indicadores.fallas.nota')}
        >
          <FallasPorCodigo fallas={datos.fallas} />
        </Tarjeta>
      </div>

      {operacion}

      <Tarjeta titulo={t('indicadores.tabla.titulo')}>
        <TablaTramos tramos={datos.actual} etiquetas={etiquetas} />
      </Tarjeta>
    </>
  )
}

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
          <h2 className="text-[15px] font-bold">{titulo}</h2>
          {nota && <p className="text-[12.5px] text-suave">{nota}</p>}
        </div>
        {extra}
      </div>
      {children}
    </section>
  )
}

function CicloPorTramo({
  tramos,
  etiquetas,
}: {
  tramos: Tramo[]
  etiquetas: string[]
}) {
  const { t } = useTranslation()
  const valores = tramos.map((tramo) => cicloPromedio(tramo))
  const conValor = valores.filter((v): v is number => v !== null)
  if (conValor.length === 0)
    return (
      <p className="text-[13px] text-suave">{t('indicadores.ciclo.sin')}</p>
    )
  // el eje llega a un número redondo arriba del más lento
  const maximo = Math.max(10, Math.ceil(Math.max(...conValor) / 10) * 10)
  return (
    <Linea
      etiquetas={etiquetas}
      valores={valores}
      maximo={maximo}
      arriba={`${maximo} s`}
      descripciones={tramos.map((tramo, i) => {
        const v = valores[i]
        return v === null || v === undefined
          ? t('indicadores.ciclo.sinTramo', { tramo: etiquetas[i] })
          : t('indicadores.ciclo.detalle', {
              tramo: etiquetas[i],
              valor: segundosCiclo(v),
              ciclos: tramo.ciclos,
            })
      })}
    />
  )
}

// Las fallas del periodo agrupadas por código, de la más frecuente a la menos (Pareto).
function FallasPorCodigo({ fallas }: { fallas: EventoFalla[] }) {
  const { t } = useTranslation()
  const lista = fallasPorCodigo(fallas)
  if (lista.length === 0)
    return (
      <p className="text-[13px] text-suave">
        {t('indicadores.fallas.ninguna')}
      </p>
    )
  const maximo = lista[0]?.veces ?? 1
  return (
    <ul className="flex flex-col gap-1.5">
      {lista.map(({ codigo, veces }) => (
        <li
          key={codigo ?? 'sin'}
          className="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-2 text-[12.5px]"
        >
          <span className="text-suave">
            {codigo === null
              ? t('indicadores.fallas.sinCodigo')
              : t('indicadores.fallas.codigo', { codigo })}
          </span>
          <span className="h-3 rounded-r-[4px] bg-linea/40">
            <span
              className="block h-full rounded-r-[4px] bg-alerta"
              style={{ width: `${(veces / maximo) * 100}%` }}
            />
          </span>
          <span className="text-right font-bold tabular-nums">
            {t('indicadores.fallas.veces', { count: veces })}
          </span>
        </li>
      ))}
    </ul>
  )
}

// Una sola barra al 100 %: marcha, mantenimiento, paro y sin registro.
function UsoDelTiempo({
  total,
  tiempoTotal,
}: {
  total: Totales
  tiempoTotal: number
}) {
  const { t } = useTranslation()
  if (tiempoTotal <= 0) return null
  const partes = [
    { clave: 'marcha', clase: 'bg-ok', segundos: total.marcha },
    {
      clave: 'mantenimiento',
      clase: 'bg-aviso',
      segundos: total.mantenimiento,
    },
    { clave: 'paro', clase: 'bg-alerta', segundos: total.paro },
    { clave: 'sinRegistro', clase: 'bg-linea', segundos: total.sinRegistro },
  ] as const
  return (
    <>
      <div className="flex h-8 gap-[2px] overflow-hidden rounded-[4px]">
        {partes.map(({ clave, clase, segundos }) =>
          segundos > 0 ? (
            <span
              key={clave}
              title={t(`indicadores.tiempo.${clave}`)}
              className={clase}
              style={{ width: `${(segundos / tiempoTotal) * 100}%` }}
            />
          ) : null,
        )}
      </div>
      <ul className="grid gap-2 text-[13px] sm:grid-cols-2">
        {partes.map(({ clave, clase, segundos }) => (
          <li key={clave} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={`h-3 w-3 shrink-0 rounded-[2px] ${clase}`}
            />
            <span className="text-suave">
              {t(`indicadores.tiempo.${clave}`)}
            </span>
            <span className="ml-auto font-bold tabular-nums">
              {horas(segundos)} · {numero((segundos / tiempoTotal) * 100)} %
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}

function TablaTramos({
  tramos,
  etiquetas,
}: {
  tramos: Tramo[]
  etiquetas: string[]
}) {
  const { t } = useTranslation()
  const columnas = [
    'tramo',
    'aluminio',
    'plastico',
    'piezas',
    'disponibilidad',
    'paros',
    'fallas',
    'ciclo',
  ] as const
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-left text-[12.5px] tabular-nums">
        <thead className="text-suave">
          <tr>
            {columnas.map((c) => (
              <th key={c} className="py-1.5 pr-3 font-semibold">
                {t(`indicadores.tabla.${c}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tramos.map((tramo, i) => {
            const d = disponibilidad(tramo)
            const c = cicloPromedio(tramo)
            return (
              <tr key={tramo.inicio} className="border-t border-linea">
                <td className="py-1.5 pr-3">{etiquetas[i]}</td>
                <td className="py-1.5 pr-3">{numero(tramo.aluminio)}</td>
                <td className="py-1.5 pr-3">{numero(tramo.plastico)}</td>
                <td className="py-1.5 pr-3 font-bold">
                  {numero(tramo.aluminio + tramo.plastico)}
                </td>
                <td className="py-1.5 pr-3">
                  {d === null ? '—' : `${numero(d, 1)} %`}
                </td>
                <td className="py-1.5 pr-3">{numero(tramo.paros)}</td>
                <td className="py-1.5 pr-3">{numero(tramo.fallas)}</td>
                <td className="py-1.5 pr-3">
                  {c === null ? '—' : segundosCiclo(c)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
