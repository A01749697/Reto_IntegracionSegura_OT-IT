import { useTranslation } from 'react-i18next'
import CaminoZonas from '../comun/CaminoZonas'
import { boton } from '../comun/estilos'
import FranjaZonas from '../comun/FranjaZonas'
import SelectorIdioma from '../idioma/SelectorIdioma'
import BotonTema from '../tema/BotonTema'

type Props = {
  irLogin: () => void
  irCrear: () => void
}

const FUNCIONES = ['cuentas', 'bitacora', 'estado'] as const

// Pagina publica: cuenta de que va el panel sin dar detalles internos de la red.
export default function PaginaLanding({ irLogin, irCrear }: Props) {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-screen flex-col font-sans text-texto">
      <FranjaZonas />
      <header className="mx-auto flex w-full max-w-[1040px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-7">
        <span className="text-base font-bold tracking-tight">
          {t('comun.marca')}
        </span>
        <div className="contents sm:flex sm:items-center sm:gap-2.5">
          <div className="flex items-center gap-2.5">
            <SelectorIdioma />
            <BotonTema />
          </div>
          <div className="flex w-full gap-2.5 sm:w-auto">
            <button
              type="button"
              onClick={irCrear}
              className={`${boton('contorno')} flex-1 sm:flex-none`}
            >
              {t('landing.crearCuenta')}
            </button>
            <button
              type="button"
              onClick={irLogin}
              className={`${boton('principal')} flex-1 sm:flex-none`}
            >
              {t('landing.iniciarSesion')}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1040px] flex-1 flex-col px-4 pt-10 pb-12 sm:px-7 sm:pt-14">
        <h1 className="max-w-[22ch] text-[30px] leading-[1.14] font-bold tracking-[-0.025em] sm:text-[40px]">
          {t('landing.titulo')}
        </h1>
        <p className="mt-4 max-w-[60ch] text-[15px] text-suave">
          {t('landing.intro')}
        </p>

        <div className="mt-12 sm:mt-14">
          <CaminoZonas tamano="grande" />
        </div>

        <ul className="mt-14 grid gap-8 sm:grid-cols-3">
          {FUNCIONES.map((clave) => (
            <li key={clave} className="border-t border-linea pt-3.5">
              <h2 className="text-[14.5px] font-bold">
                {t(`landing.funciones.${clave}.titulo`)}
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-suave">
                {t(`landing.funciones.${clave}.texto`)}
              </p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
