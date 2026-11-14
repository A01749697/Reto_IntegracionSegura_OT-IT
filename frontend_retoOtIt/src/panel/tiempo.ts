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

// fecha y hora sin segundos, para listas donde la precisión es de minutos
export function fechaHoraCorta(iso: string): string {
  return new Date(iso).toLocaleString(region(), {
    dateStyle: 'medium',
    timeStyle: 'short',
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

// Un tramo de tiempo, como "45 min", "1 h 30 min" o "2 d 3 h". Las abreviaturas son iguales en los dos idiomas.
export function duracion(segundos: number): string {
  const minutos = Math.max(1, Math.round(segundos / 60))
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  if (horas < 24) return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`
  const dias = Math.floor(horas / 24)
  const horasResto = horas % 24
  return horasResto === 0 ? `${dias} d` : `${dias} d ${horasResto} h`
}
