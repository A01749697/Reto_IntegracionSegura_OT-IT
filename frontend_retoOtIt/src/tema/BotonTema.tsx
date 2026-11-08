import { useState } from 'react'
import { Moon, Sun } from 'reicon-react'
import { aplicarTema, temaActual, type Tema } from './tema'

export default function BotonTema() {
  const [tema, setTema] = useState<Tema>(temaActual)

  function alternar() {
    const nuevo: Tema = tema === 'oscuro' ? 'claro' : 'oscuro'
    aplicarTema(nuevo)
    setTema(nuevo)
  }

  const Icono = tema === 'oscuro' ? Sun : Moon
  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={
        tema === 'oscuro' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'
      }
      className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-linea bg-panel text-texto hover:border-acento focus-visible:ring-[3px] focus-visible:ring-acento/45 focus-visible:outline-none"
    >
      <Icono size={18} aria-hidden="true" />
    </button>
  )
}
