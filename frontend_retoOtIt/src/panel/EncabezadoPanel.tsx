import { useTranslation } from 'react-i18next'
import FranjaZonas from '../comun/FranjaZonas'
import type { Usuario } from '../login/apiPanel'
import BotonTema from '../tema/BotonTema'
import MenuUsuario from './MenuUsuario'

export type Seccion =
  | 'inicio'
  | 'cuentas'
  | 'bitacora'
  | 'datos'
  | 'estado'
  | 'gemelo'
  | 'cuenta'
  | 'ayuda'

type Props = {
  usuario: Usuario
  // null cuando la direccion no es de ninguna pantalla
  actual: Seccion | null
  irA: (seccion: Seccion) => void
  cerrarSesion: () => Promise<boolean>
}

type Pestana = Exclude<Seccion, 'ayuda'>

const SECCIONES: { seccion: Pestana; soloAdmin: boolean }[] = [
  { seccion: 'inicio', soloAdmin: false },
  { seccion: 'cuentas', soloAdmin: true },
  { seccion: 'bitacora', soloAdmin: true },
  { seccion: 'datos', soloAdmin: true },
  { seccion: 'estado', soloAdmin: false },
  { seccion: 'gemelo', soloAdmin: false },
  { seccion: 'cuenta', soloAdmin: false },
]

// A la izquierda el nombre del panel y las pestañas; a la derecha el tema y el menú de la persona.
// En pantallas angostas las pestañas bajan a su propia fila y se deslizan de lado.
export default function EncabezadoPanel({
  usuario,
  actual,
  irA,
  cerrarSesion,
}: Props) {
  const { t } = useTranslation()
  const esAdmin = usuario.rol === 'administrador'

  return (
    <header className="relative z-20 border-b border-linea bg-fondo">
      <FranjaZonas />
      <div className="flex flex-wrap items-center gap-x-8 px-4 sm:px-6 xl:flex-nowrap">
        <span className="py-3 text-base font-bold tracking-tight whitespace-nowrap">
          {t('comun.marca')}
        </span>

        <nav
          aria-label={t('encabezado.secciones')}
          className="order-last -mx-4 -mb-px flex w-[calc(100%+2rem)] overflow-x-auto overflow-y-hidden px-4 [scrollbar-width:none] sm:-mx-6 sm:w-[calc(100%+3rem)] sm:px-6 xl:order-none xl:mx-0 xl:w-auto xl:flex-1 xl:px-0 [&::-webkit-scrollbar]:hidden"
        >
          {SECCIONES.filter((s) => !s.soloAdmin || esAdmin).map(
            ({ seccion }) => {
              const activa = seccion === actual
              return (
                <button
                  key={seccion}
                  type="button"
                  aria-current={activa ? 'page' : undefined}
                  onClick={() => irA(seccion)}
                  className={`h-[52px] shrink-0 cursor-pointer border-b-[3px] px-3.5 text-[13.5px] focus-visible:ring-[3px] focus-visible:ring-acento/45 focus-visible:outline-none ${
                    activa
                      ? 'border-acento font-bold text-texto'
                      : 'border-transparent font-medium text-suave hover:text-texto'
                  }`}
                >
                  {t(`encabezado.pestanas.${seccion}`)}
                </button>
              )
            },
          )}
        </nav>

        <div className="ml-auto flex items-center gap-3 xl:ml-0">
          <BotonTema />
          <MenuUsuario
            usuario={usuario}
            irAMiCuenta={() => irA('cuenta')}
            irAAyuda={() => irA('ayuda')}
            cerrarSesion={cerrarSesion}
          />
        </div>
      </div>
    </header>
  )
}
