import { useTranslation } from 'react-i18next'
import { cambiarIdioma } from './i18n'
import { IDIOMAS, type Idioma } from './idiomas'

const SIGLAS: Record<Idioma, string> = { es: 'ES', en: 'EN' }

// Dos botones juntos; el del idioma activo se ve relleno.
export default function SelectorIdioma() {
  const { t, i18n } = useTranslation()
  return (
    <div
      role="group"
      aria-label={t('idioma.etiqueta')}
      className="inline-flex h-9 shrink-0 items-center rounded-lg border border-linea bg-panel p-[3px]"
    >
      {IDIOMAS.map((idioma) => {
        const activo = i18n.language === idioma
        return (
          <button
            key={idioma}
            type="button"
            lang={idioma}
            aria-label={t(`idioma.${idioma}`)}
            aria-pressed={activo}
            onClick={() => void cambiarIdioma(idioma)}
            className={`h-full cursor-pointer rounded-md px-2.5 text-[12px] font-bold focus-visible:ring-[3px] focus-visible:ring-acento/45 focus-visible:outline-none ${
              activo ? 'bg-texto text-fondo' : 'text-suave hover:text-texto'
            }`}
          >
            {SIGLAS[idioma]}
          </button>
        )
      })}
    </div>
  )
}
