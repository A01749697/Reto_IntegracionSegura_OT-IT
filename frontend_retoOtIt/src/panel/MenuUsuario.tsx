import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ChevronDown,
  HelpCircle,
  Logout,
  Translate,
  UserCircle,
} from 'reicon-react'
import { iniciales } from '../comun/iniciales'
import { cambiarIdioma } from '../idioma/i18n'
import { esIdioma, type Idioma } from '../idioma/idiomas'
import type { Usuario } from '../login/apiPanel'

type Props = {
  usuario: Usuario
  irAMiCuenta: () => void
  irAAyuda: () => void
  cerrarSesion: () => Promise<boolean>
}

const OPCION =
  'flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] hover:bg-campo focus:bg-campo focus:outline-none'

// Las opciones que se pueden usar con las flechas.
function opciones(raiz: HTMLElement | null): HTMLElement[] {
  if (!raiz) return []
  return Array.from(
    raiz.querySelectorAll<HTMLElement>(
      '[role="menuitem"]:not([aria-disabled="true"])',
    ),
  )
}

// Botón con el nombre de quien tiene la sesión; al pulsarlo se abre su menú.
export default function MenuUsuario({
  usuario,
  irAMiCuenta,
  irAAyuda,
  cerrarSesion,
}: Props) {
  const [abierto, setAbierto] = useState(false)
  const [saliendo, setSaliendo] = useState(false)
  const [error, setError] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const boton = useRef<HTMLButtonElement>(null)
  const { t, i18n } = useTranslation()
  const idioma: Idioma = esIdioma(i18n.language) ? i18n.language : 'es'
  const otro: Idioma = idioma === 'es' ? 'en' : 'es'

  // al abrir, el foco va a la primera opción para poder usar el teclado
  useEffect(() => {
    if (abierto) opciones(raiz.current)[0]?.focus()
  }, [abierto])

  // un clic fuera lo cierra
  useEffect(() => {
    if (!abierto) return
    function fuera(evento: MouseEvent) {
      if (!raiz.current?.contains(evento.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierto])

  function cerrar(devolverFoco: boolean) {
    setAbierto(false)
    setError(false)
    if (devolverFoco) boton.current?.focus()
  }

  function alPulsarTecla(evento: KeyboardEvent) {
    if (!abierto) {
      if (evento.key === 'ArrowDown') {
        evento.preventDefault()
        setAbierto(true)
      }
      return
    }
    if (evento.key === 'Escape') {
      evento.preventDefault()
      cerrar(true)
      return
    }
    if (evento.key === 'Tab') {
      cerrar(false)
      return
    }
    const lista = opciones(raiz.current)
    if (lista.length === 0) return
    const actual = lista.indexOf(document.activeElement as HTMLElement)
    const destino: Record<string, number> = {
      ArrowDown: (actual + 1) % lista.length,
      ArrowUp: (actual - 1 + lista.length) % lista.length,
      Home: 0,
      End: lista.length - 1,
    }
    const siguiente = destino[evento.key]
    if (siguiente !== undefined) {
      evento.preventDefault()
      lista[siguiente]?.focus()
    }
  }

  async function salir() {
    setSaliendo(true)
    setError(false)
    const cerrada = await cerrarSesion()
    // si se cerró, la pantalla ya cambió y este componente desaparece
    if (!cerrada) {
      setError(true)
      setSaliendo(false)
    }
  }

  return (
    <div ref={raiz} onKeyDown={alPulsarTecla} className="relative">
      <button
        ref={boton}
        type="button"
        aria-label={t('menu.boton', { nombre: usuario.nombre })}
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={() => (abierto ? cerrar(false) : setAbierto(true))}
        className="flex h-10 cursor-pointer items-center gap-2.5 rounded-lg border-[1.5px] border-linea pr-2.5 pl-1.5 hover:border-acento focus-visible:ring-[3px] focus-visible:ring-acento/45 focus-visible:outline-none"
      >
        <span
          aria-hidden="true"
          className="flex h-7 w-7 items-center justify-center rounded-md bg-acento text-[11.5px] font-bold text-sobre"
        >
          {iniciales(usuario.nombre)}
        </span>
        <span className="hidden text-left text-[12.5px] leading-tight sm:block">
          {usuario.nombre}
          <span className="block text-[11.5px] text-suave">
            {t(`general.roles.${usuario.rol}`)}
          </span>
        </span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`text-suave ${abierto ? 'rotate-180' : ''}`}
        />
      </button>

      {abierto && (
        <div
          role="menu"
          aria-label={t('menu.etiqueta')}
          className="absolute top-[calc(100%+8px)] right-0 z-30 w-[260px] rounded-[10px] border border-linea bg-panel p-1.5 shadow-lg"
        >
          <div className="px-2.5 pt-1.5 pb-2.5">
            <p className="text-[13px] font-bold break-words">
              {usuario.nombre}
            </p>
            <p className="text-[12px] break-all text-suave">{usuario.correo}</p>
          </div>
          <div role="separator" className="mb-1 h-px bg-linea" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              cerrar(false)
              irAMiCuenta()
            }}
            className={OPCION}
          >
            <UserCircle size={18} aria-hidden="true" className="text-suave" />
            {t('menu.miCuenta')}
          </button>

          {/* con dos idiomas basta un toque para pasar al otro; el menú queda abierto */}
          <button
            type="button"
            role="menuitem"
            aria-label={t('menu.cambiarIdioma', {
              actual: t(`idioma.${idioma}`),
              otro: t(`idioma.${otro}`),
            })}
            onClick={() => void cambiarIdioma(otro)}
            className={OPCION}
          >
            <Translate size={18} aria-hidden="true" className="text-suave" />
            {t('menu.idioma')}
            <span className="ml-auto text-[12px] text-suave">
              {t(`idioma.${idioma}`)}
            </span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              cerrar(false)
              irAAyuda()
            }}
            className={OPCION}
          >
            <HelpCircle size={18} aria-hidden="true" className="text-suave" />
            {t('menu.ayuda')}
          </button>

          <div role="separator" className="my-1 h-px bg-linea" />

          <button
            type="button"
            role="menuitem"
            disabled={saliendo}
            onClick={salir}
            className={`${OPCION} text-alerta disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <Logout size={18} aria-hidden="true" />
            {t('menu.cerrarSesion')}
          </button>

          {error && (
            <p
              role="alert"
              className="px-2.5 pt-1.5 pb-1 text-[12.5px] text-alerta"
            >
              {t('menu.errorCerrar')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
