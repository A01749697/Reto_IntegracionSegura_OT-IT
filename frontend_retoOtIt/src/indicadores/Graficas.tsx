// Gráficas de la vista de dirección, hechas con HTML y SVG (sin librerías).
// Todas son columnas con el mismo eje: cada columna es un tramo que se puede señalar con el
// ratón o con el teclado para ver su detalle.
import { useState, type ReactNode } from 'react'

type Marco = {
  etiquetas: string[] // texto bajo cada columna (se muestran solo algunas)
  descripciones: string[] // para lectores de pantalla y el detalle
  arriba: string // valor del tope del eje
  alto?: number
}

function Columnas({
  etiquetas,
  descripciones,
  arriba,
  alto = 192,
  columna,
  fondo,
}: Marco & {
  columna?: (i: number) => ReactNode
  fondo?: ReactNode
}) {
  const [activa, setActiva] = useState<number | null>(null)
  const n = etiquetas.length
  // como mucho 8 etiquetas en el eje, repartidas
  const cada = Math.max(1, Math.ceil(n / 8))
  return (
    <div className="flex gap-2">
      <div
        className="flex flex-col justify-between text-right text-[11px] text-suave tabular-nums"
        style={{ height: alto }}
      >
        <span>{arriba}</span>
        <span>0</span>
      </div>
      <div className="relative min-w-0 flex-1">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 border-t border-dashed border-linea"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 border-t border-dashed border-linea"
          style={{ top: alto / 2 }}
        />
        {fondo && (
          <div className="absolute inset-x-0 top-0" style={{ height: alto }}>
            {fondo}
          </div>
        )}
        <div
          className="relative flex items-end gap-[2px] border-b border-linea"
          style={{ height: alto }}
          onMouseLeave={() => setActiva(null)}
        >
          {etiquetas.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={descripciones[i]}
              onMouseEnter={() => setActiva(i)}
              onFocus={() => setActiva(i)}
              onBlur={() => setActiva(null)}
              className={`flex h-full min-w-0 flex-1 cursor-default flex-col justify-end gap-[2px] rounded-t-[4px] focus-visible:ring-2 focus-visible:ring-acento/45 focus-visible:outline-none ${
                activa === i ? 'bg-texto/5' : ''
              }`}
            >
              {columna?.(i)}
            </button>
          ))}
        </div>
        {activa !== null && (
          <div
            role="tooltip"
            className="pointer-events-none absolute top-0 z-10 w-max max-w-[16rem] rounded-md border border-linea bg-fondo px-2.5 py-1.5 text-[12px] leading-snug shadow-lg"
            style={{
              left: `${((activa + 0.5) / n) * 100}%`,
              transform: `translate(${activa < n / 2 ? '-10%' : '-90%'}, -100%)`,
            }}
          >
            {descripciones[activa]}
          </div>
        )}
        <div className="relative mt-1 h-4 text-[11px] text-suave tabular-nums">
          {etiquetas.map((texto, i) =>
            i % cada === 0 ? (
              <span
                key={i}
                className="absolute -translate-x-1/2 whitespace-nowrap"
                style={{ left: `${((i + 0.5) / n) * 100}%` }}
              >
                {texto}
              </span>
            ) : null,
          )}
        </div>
      </div>
    </div>
  )
}

export type Serie = { clase: string; valores: number[] }

// Barras apiladas (de abajo hacia arriba en el orden de las series).
// tope fija el eje (100 para porcentajes); si no, llega a la columna más alta.
export function BarrasApiladas({
  series,
  tope,
  unidad = '',
  ...marco
}: Omit<Marco, 'arriba'> & {
  series: Serie[]
  tope?: number
  unidad?: string
}) {
  const n = marco.etiquetas.length
  const totales = Array.from({ length: n }, (_, i) =>
    series.reduce((suma, s) => suma + (s.valores[i] ?? 0), 0),
  )
  const maximo = tope ?? Math.max(1, Math.ceil(Math.max(...totales)))
  return (
    <Columnas
      {...marco}
      arriba={`${maximo}${unidad}`}
      columna={(i) =>
        [...series].reverse().map((s, j) => {
          const valor = s.valores[i] ?? 0
          if (valor <= 0) return null
          // solo la de hasta arriba lleva las esquinas redondeadas
          const tope = [...series]
            .reverse()
            .findIndex((otra) => (otra.valores[i] ?? 0) > 0)
          return (
            <span
              key={s.clase}
              className={`w-full ${s.clase} ${j === tope ? 'rounded-t-[4px]' : ''}`}
              style={{ height: `${(valor / maximo) * 100}%` }}
            />
          )
        })
      }
    />
  )
}

// Una línea; los tramos sin valor la cortan.
export function Linea({
  valores,
  maximo,
  arriba,
  ...marco
}: Marco & { valores: (number | null)[]; maximo: number }) {
  const n = valores.length
  const x = (i: number) => ((i + 0.5) / n) * 100
  const y = (v: number) => 100 - (Math.min(v, maximo) / maximo) * 100
  const trazos: string[] = []
  let actual = ''
  valores.forEach((v, i) => {
    if (v === null) {
      if (actual) trazos.push(actual)
      actual = ''
      return
    }
    actual += `${actual ? 'L' : 'M'}${x(i)},${y(v)} `
  })
  if (actual) trazos.push(actual)
  return (
    <Columnas
      {...marco}
      arriba={arriba}
      fondo={
        <>
          <svg
            aria-hidden="true"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full overflow-visible"
          >
            {trazos.map((d) => (
              <path
                key={d}
                d={d}
                fill="none"
                stroke="var(--color-acento)"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
          {valores.map((v, i) =>
            v === null ? null : (
              <span
                key={i}
                aria-hidden="true"
                className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-panel bg-acento"
                style={{ left: `${x(i)}%`, top: `${y(v)}%` }}
              />
            ),
          )}
        </>
      }
    />
  )
}

export function Leyenda({
  series,
}: {
  series: [clase: string, texto: string][]
}) {
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
