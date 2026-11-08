import CaminoZonas from '../comun/CaminoZonas'
import { boton } from '../comun/estilos'
import FranjaZonas from '../comun/FranjaZonas'
import BotonTema from '../tema/BotonTema'

type Props = {
  irLogin: () => void
  irCrear: () => void
}

const FUNCIONES = [
  {
    titulo: 'Cuentas con aprobación',
    texto: 'Quien pide acceso espera a que un administrador lo apruebe.',
  },
  {
    titulo: 'Bitácora de seguridad',
    texto: 'Cada acceso, bloqueo y cambio de rol queda registrado.',
  },
  {
    titulo: 'Estado del sistema',
    texto:
      'Revisa si la API, las bases de datos y la llegada de datos están al día.',
  },
]

// Pagina publica: cuenta de que va el panel sin dar detalles internos de la red.
export default function PaginaLanding({ irLogin, irCrear }: Props) {
  return (
    <div className="flex min-h-screen flex-col font-sans text-texto">
      <FranjaZonas />
      <header className="mx-auto flex w-full max-w-[1040px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-7">
        <span className="text-base font-bold tracking-tight">
          Panel Reto OT-IT
        </span>
        <div className="flex items-center gap-2.5">
          <BotonTema />
          <button type="button" onClick={irCrear} className={boton('contorno')}>
            Crear cuenta
          </button>
          <button
            type="button"
            onClick={irLogin}
            className={boton('principal')}
          >
            Iniciar sesión
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1040px] flex-1 flex-col px-4 pt-10 pb-12 sm:px-7 sm:pt-14">
        <h1 className="max-w-[22ch] text-[30px] leading-[1.14] font-bold tracking-[-0.025em] sm:text-[40px]">
          Tus datos de planta, seguros hasta la nube
        </h1>
        <p className="mt-4 max-w-[60ch] text-[15px] text-suave">
          Un panel para vigilar el camino que sigue la información desde los PLC
          hasta el servidor, pasando por cada zona de la red.
        </p>

        <div className="mt-12 sm:mt-14">
          <CaminoZonas tamano="grande" />
        </div>

        <ul className="mt-14 grid gap-8 sm:grid-cols-3">
          {FUNCIONES.map(({ titulo, texto }) => (
            <li key={titulo} className="border-t border-linea pt-3.5">
              <h2 className="text-[14.5px] font-bold">{titulo}</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-suave">
                {texto}
              </p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
