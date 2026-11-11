import { useTranslation } from 'react-i18next'

type Props = {
  tamano: 'grande' | 'compacto'
}

type Zona = {
  clave: 'ot' | 'idmz' | 'it' | 'nube'
  punto: string
}

const ZONAS: Zona[] = [
  { clave: 'ot', punto: 'border-zona-ot' },
  { clave: 'idmz', punto: 'border-zona-idmz' },
  { clave: 'it', punto: 'border-zona-it' },
  {
    clave: 'nube',
    punto:
      'border-zona-nube bg-zona-nube shadow-[0_0_0_6px_color-mix(in_srgb,var(--c-nube)_22%,transparent)]',
  },
]

const MEDIDAS = {
  grande: {
    nodo: 'w-[84px] gap-2.5 sm:w-[150px]',
    punto: 'h-[18px] w-[18px]',
    nube: 'h-7 w-7 -my-[5px]',
    nombre: 'text-base sm:text-[19px]',
    nombreNube: 'text-lg sm:text-[23px]',
    detalle: 'text-[11px] sm:text-[12.5px]',
    linea: 'mt-[7px]',
  },
  compacto: {
    nodo: 'w-[62px] gap-[7px]',
    punto: 'h-3 w-3',
    nube: 'h-5 w-5 -my-1',
    nombre: 'text-sm',
    nombreNube: 'text-base',
    detalle: 'text-[11px]',
    linea: 'mt-[5px]',
  },
}

// Los guiones avanzan hacia la Nube; con "reducir movimiento" se quedan quietos.
function Linea({ margen }: { margen: string }) {
  return (
    <svg aria-hidden="true" className={`h-[3px] min-w-0 flex-1 ${margen}`}>
      <line
        x1="0"
        y1="1.5"
        x2="100%"
        y2="1.5"
        strokeWidth="2"
        strokeDasharray="8 8"
        className="animate-flujo stroke-suave/60 motion-reduce:animate-none"
      />
    </svg>
  )
}

export default function CaminoZonas({ tamano }: Props) {
  const { t } = useTranslation()
  const m = MEDIDAS[tamano]
  return (
    <div
      role="img"
      aria-label={t('camino.etiqueta')}
      className="flex items-start"
    >
      {ZONAS.map((zona, i) => {
        const esNube = i === ZONAS.length - 1
        return (
          <div key={zona.clave} className="contents">
            {i > 0 && <Linea margen={m.linea} />}
            <div className={`flex flex-none flex-col items-center ${m.nodo}`}>
              <span
                className={`block rounded-full border-[3px] ${zona.punto} ${esNube ? m.nube : `${m.punto} bg-fondo`}`}
              />
              <span
                className={`font-bold ${esNube ? `${m.nombreNube} text-zona-nube` : `${m.nombre} text-texto`}`}
              >
                {t(`camino.zonas.${zona.clave}.nombre`)}
              </span>
              <span
                className={`text-center leading-tight text-suave ${m.detalle}`}
              >
                {t(`camino.zonas.${zona.clave}.descripcion`)}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
