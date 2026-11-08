import type { InputHTMLAttributes, ReactNode } from 'react'
import type { IconComponent } from 'reicon-react/createIcon'

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'id'
> & {
  id: string
  etiqueta: string
  Icono: IconComponent
  valor: string
  alCambiar: (valor: string) => void
  /** Contenido a la derecha, dentro del campo (por ejemplo, el ojo). */
  derecha?: ReactNode
}

export default function CampoTexto({
  id,
  etiqueta,
  Icono,
  valor,
  alCambiar,
  derecha,
  ...resto
}: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-texto">
        {etiqueta}
      </label>
      <div className="relative">
        <Icono
          size={18}
          aria-hidden="true"
          className="pointer-events-none absolute top-[13px] left-3.5 text-suave"
        />
        <input
          id={id}
          value={valor}
          onChange={(e) => alCambiar(e.target.value)}
          className={`h-11 w-full rounded-lg border-[1.5px] border-linea bg-campo pl-11 text-[14px] text-texto outline-none placeholder:text-suave hover:border-suave focus:border-acento focus:ring-[3px] focus:ring-acento/30 ${derecha ? 'pr-12' : 'pr-3.5'}`}
          {...resto}
        />
        {derecha}
      </div>
    </div>
  )
}
