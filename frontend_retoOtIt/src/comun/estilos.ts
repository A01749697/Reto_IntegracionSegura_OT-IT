// Clases que se repiten en varias pantallas.
const BASE =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border-[1.5px] font-semibold focus-visible:ring-[3px] focus-visible:ring-acento/45 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60'

const COLORES = {
  principal: 'border-acento bg-acento text-sobre hover:brightness-110',
  contorno: 'border-acento text-acento hover:bg-acento/10',
  peligro: 'border-linea text-alerta hover:border-alerta',
  alerta: 'border-alerta bg-alerta text-sobre hover:brightness-110',
  neutro: 'border-linea text-texto hover:border-acento',
}

const MEDIDAS = {
  normal: 'h-9 px-3.5 text-[13px]',
  grande: 'h-11 px-5 text-[15px]',
}

export function boton(
  color: keyof typeof COLORES,
  medida: keyof typeof MEDIDAS = 'normal',
): string {
  return `${BASE} ${COLORES[color]} ${MEDIDAS[medida]}`
}

export function avisoClases(error: boolean): string {
  const base =
    'flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-[13.5px] leading-snug'
  return error
    ? `${base} border-alerta/50 bg-alerta/10 text-alerta`
    : `${base} border-ok/50 bg-ok/10 text-ok`
}

export const CAMPO_BUSQUEDA =
  'h-9 w-full rounded-lg border-[1.5px] border-linea bg-campo pr-3 pl-9 text-[13px] text-texto outline-none placeholder:text-suave hover:border-suave focus:border-acento focus:ring-[3px] focus:ring-acento/30'

export const TARJETA = 'rounded-[10px] border border-linea bg-panel'
