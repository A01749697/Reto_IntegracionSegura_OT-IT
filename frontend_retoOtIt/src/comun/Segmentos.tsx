type Props<T extends string> = {
  opciones: { valor: T; texto: string }[]
  valor: T
  alCambiar: (valor: T) => void
  etiqueta?: string
}

// Grupo de botones para elegir un filtro; el activo se ve relleno.
export default function Segmentos<T extends string>({
  opciones,
  valor,
  alCambiar,
  etiqueta = 'Filtro',
}: Props<T>) {
  return (
    <div
      role="group"
      aria-label={etiqueta}
      className="inline-flex flex-wrap rounded-[9px] border border-linea bg-panel p-[3px]"
    >
      {opciones.map((opcion) => {
        const activo = opcion.valor === valor
        return (
          <button
            key={opcion.valor}
            type="button"
            aria-pressed={activo}
            onClick={() => alCambiar(opcion.valor)}
            className={`cursor-pointer rounded-md px-3.5 py-1.5 text-[12.5px] font-semibold focus-visible:ring-[3px] focus-visible:ring-acento/45 focus-visible:outline-none ${
              activo ? 'bg-texto text-fondo' : 'text-suave hover:text-texto'
            }`}
          >
            {opcion.texto}
          </button>
        )
      })}
    </div>
  )
}
