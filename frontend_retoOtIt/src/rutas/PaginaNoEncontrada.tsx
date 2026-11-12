import { useTranslation } from 'react-i18next'
import { boton } from '../comun/estilos'

type Props = {
  irAlInicio: () => void
}

// Lo que se ve cuando la direccion no corresponde a ninguna pantalla.
export default function PaginaNoEncontrada({ irAlInicio }: Props) {
  const { t } = useTranslation()
  return (
    <main className="flex w-full flex-col items-start gap-4 px-4 py-12 sm:px-6">
      <p
        aria-hidden="true"
        className="text-[56px] leading-none font-bold text-acento"
      >
        404
      </p>
      <h1 className="text-[28px] leading-tight font-bold tracking-tight">
        {t('noEncontrada.titulo')}
      </h1>
      <p className="text-[14px] text-suave">{t('noEncontrada.texto')}</p>
      <button type="button" onClick={irAlInicio} className={boton('principal')}>
        {t('noEncontrada.volver')}
      </button>
    </main>
  )
}
