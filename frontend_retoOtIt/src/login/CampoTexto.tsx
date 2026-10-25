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
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-base font-semibold text-tinta">
        {etiqueta}
      </label>
      <div className="relative">
        <Icono
          size={20}
          aria-hidden="true"
          className="pointer-events-none absolute top-[19px] left-4 text-gris-azul"
        />
        <input
          id={id}
          value={valor}
          onChange={(e) => alCambiar(e.target.value)}
          className={`h-[58px] w-full rounded-[10px] border border-borde bg-campo pl-[52px] text-[17px] text-tinta outline-none placeholder:text-[#5a6f8f] hover:border-[#7f9cc9] focus:border-turquesa focus:bg-white focus:ring-[3px] focus:ring-turquesa/30 ${derecha ? 'pr-[58px]' : 'pr-4'}`}
          {...resto}
        />
        {derecha}
      </div>
    </div>
  )
}
