import i18n from '../idioma/i18n'

// cada idioma escribe la fecha a su manera
const REGION: Record<string, string> = { es: 'es-MX', en: 'en-US' }

export const region = (): string => REGION[i18n.language] ?? 'es-MX'

export function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString(region(), {
    dateStyle: 'medium',
    timeStyle: 'medium',
  })
}

export function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString(region(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function hace(segundos: number): string {
  if (segundos < 60) return i18n.t('tiempo.segundos', { n: segundos })
  const minutos = Math.floor(segundos / 60)
  if (minutos < 60) return i18n.t('tiempo.minutos', { n: minutos })
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return i18n.t('tiempo.horas', { n: horas })
  return i18n.t('tiempo.dias', { n: Math.floor(horas / 24) })
}
