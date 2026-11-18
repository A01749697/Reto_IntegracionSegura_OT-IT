import type { es } from './es'

// Con esto, t('clave.que.no.existe') no compila.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: { translation: typeof es }
  }
}
