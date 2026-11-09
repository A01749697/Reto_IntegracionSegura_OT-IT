import { useState } from 'react'
import FranjaZonas from '../comun/FranjaZonas'
import type { Usuario } from '../login/apiPanel'
import BotonTema from '../tema/BotonTema'

export type Seccion =
  'inicio' | 'cuentas' | 'bitacora' | 'datos' | 'estado' | 'cuenta'

type Props = {
  usuario: Usuario
  actual: Seccion
  irA: (seccion: Seccion) => void
  cerrarSesion: () => Promise<boolean>
}

const SECCIONES: { seccion: Seccion; texto: string; soloAdmin: boolean }[] = [
  { seccion: 'inicio', texto: 'Inicio', soloAdmin: false },
  { seccion: 'cuentas', texto: 'Cuentas', soloAdmin: true },
  { seccion: 'bitacora', texto: 'Bitácora', soloAdmin: true },
  { seccion: 'datos', texto: 'Datos', soloAdmin: true },
  { seccion: 'estado', texto: 'Estado', soloAdmin: false },
  { seccion: 'cuenta', texto: 'Mi cuenta', soloAdmin: false },
]

export default function EncabezadoPanel({
  usuario,
  actual,
  irA,
  cerrarSesion,
}: Props) {
  const [saliendo, setSaliendo] = useState(false)
  const [error, setError] = useState(false)
  const esAdmin = usuario.rol === 'administrador'

  async function salir() {
    setSaliendo(true)
    setError(false)
    const cerrada = await cerrarSesion()
    // si se cerro, la pantalla ya cambio y este componente desaparece
    if (!cerrada) {
      setError(true)
      setSaliendo(false)
    }
  }

  return (
    <header className="border-b border-linea bg-fondo">
      <FranjaZonas />
      <div className="mx-auto flex max-w-[1040px] flex-wrap items-center gap-x-8 gap-y-2 px-4 sm:px-7">
        <span className="py-4 text-base font-bold tracking-tight">
          Panel Reto OT-IT
        </span>

        <nav
          aria-label="Secciones"
          className="order-last -mx-4 flex w-[calc(100%+2rem)] gap-1 overflow-x-auto px-4 sm:order-none sm:mx-0 sm:w-auto sm:flex-1 sm:px-0"
        >
          {SECCIONES.filter((s) => !s.soloAdmin || esAdmin).map(
            ({ seccion, texto }) => {
              const activa = seccion === actual
              return (
                <button
                  key={seccion}
                  type="button"
                  aria-current={activa ? 'page' : undefined}
                  onClick={() => irA(seccion)}
                  className={`-mb-px h-[52px] shrink-0 cursor-pointer border-b-[3px] px-3.5 text-[13.5px] focus-visible:ring-[3px] focus-visible:ring-acento/45 focus-visible:outline-none ${
                    activa
                      ? 'border-acento font-bold text-texto'
                      : 'border-transparent font-medium text-suave hover:text-texto'
                  }`}
                >
                  {texto}
                </button>
              )
            },
          )}
        </nav>

        <div className="ml-auto flex items-center gap-3 sm:ml-0">
          <BotonTema />
          <p className="hidden text-right text-[12.5px] leading-tight sm:block">
            {usuario.nombre}
            <span className="block text-[11.5px] text-suave">
              {usuario.rol}
            </span>
          </p>
          <button
            type="button"
            disabled={saliendo}
            onClick={salir}
            className="h-9 cursor-pointer rounded-lg border-[1.5px] border-linea px-3.5 text-[12.5px] font-semibold hover:border-acento focus-visible:ring-[3px] focus-visible:ring-acento/45 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            Salir
          </button>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="mx-auto max-w-[1040px] px-4 pb-2 text-right text-[13px] text-alerta sm:px-7"
        >
          No se pudo cerrar la sesión. Inténtalo otra vez.
        </p>
      )}
    </header>
  )
}
