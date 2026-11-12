import i18n from '../idioma/i18n'
import { es } from '../idioma/es'
import type { EventoBitacora } from './apiBitacora'

type TipoConocido = keyof typeof es.eventos.tipos

export const ALERTAS = new Set([
  'entrada_fallida',
  'entrada_bloqueada',
  'cuenta_bloqueada',
  'entrada_pendiente',
  'entrada_rechazada',
  'solicitud_repetida',
  'reinicio_fallido',
  'cambio_contrasena_fallido',
])

export const esAlerta = (tipo: string) => ALERTAS.has(tipo)

const esConocido = (tipo: string): tipo is TipoConocido =>
  Object.hasOwn(es.eventos.tipos, tipo)

// Un tipo que el panel todavia no conoce se muestra tal cual llega.
export function describir(evento: EventoBitacora): string {
  const texto = esConocido(evento.tipo)
    ? i18n.t(`eventos.tipos.${evento.tipo}`)
    : evento.tipo
  return evento.actorCorreo
    ? i18n.t('eventos.por', { texto, actor: evento.actorCorreo })
    : texto
}
