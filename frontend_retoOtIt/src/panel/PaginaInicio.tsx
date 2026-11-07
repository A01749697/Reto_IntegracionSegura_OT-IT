import { useState } from 'react'
import { ShieldCheck } from 'reicon-react'
import type { Usuario } from '../login/apiPanel'

type Props = {
  usuario: Usuario
  cerrarSesion: () => Promise<boolean>
  irCuentas?: () => void
  irBitacora?: () => void
  irEstado?: () => void
}

// Pantalla provisional mientras no esta el dashboard.
export default function PaginaInicio({
  usuario,
  cerrarSesion,
  irCuentas,
  irBitacora,
  irEstado,
}: Props) {
  const [cerrando, setCerrando] = useState(false)
  const [error, setError] = useState(false)

  async function salir() {
    setCerrando(true)
    setError(false)
    const cerrada = await cerrarSesion()
    if (!cerrada) {
      setError(true)
      setCerrando(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#dbe8fd] bg-[linear-gradient(120deg,#b3cff9_0%,#dbe8fd_45%,#f6f9ff_100%)] px-4 py-12 font-sans text-tinta">
      <div className="w-full max-w-[540px] overflow-hidden rounded-[18px] border border-borde bg-white shadow-[0_18px_40px_rgba(11,47,107,0.2)]">
        <div className="flex items-center gap-4 border-b-4 border-turquesa bg-[linear-gradient(135deg,#0b2f6b_0%,#1f5fd0_100%)] px-6 py-[34px] sm:px-11">
          <ShieldCheck size={34} aria-hidden="true" className="text-white" />
          <h1 className="text-[26px] leading-tight font-bold text-white sm:text-[30px]">
            Sesión iniciada
          </h1>
        </div>
        <div className="flex flex-col gap-6 px-6 pt-10 pb-11 sm:px-11">
          <p className="text-[19px]">
            Hola, <strong>{usuario.nombre}</strong>.
          </p>
          <dl className="flex flex-col gap-1 text-[17px] text-tinta-suave">
            <div className="flex gap-2">
              <dt className="font-semibold">Correo:</dt>
              <dd>{usuario.correo}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-semibold">Rol:</dt>
              <dd>{usuario.rol}</dd>
            </div>
          </dl>
          <p className="text-[17px] text-tinta-suave">
            Todavía no está el dashboard con las lecturas de los PLC.
          </p>
          {error && (
            <p role="alert" className="text-[15px] text-[#8a1c26]">
              No se pudo cerrar la sesión. Inténtalo otra vez.
            </p>
          )}
          {irCuentas && usuario.rol === 'administrador' && (
            <button
              type="button"
              onClick={irCuentas}
              className="flex h-[58px] w-full cursor-pointer items-center justify-center rounded-[10px] bg-[linear-gradient(90deg,#174ea6,#2f6fe0)] text-[17px] font-semibold text-white hover:bg-[linear-gradient(90deg,#123f86,#2560c8)] focus-visible:ring-[3px] focus-visible:ring-turquesa/45 focus-visible:outline-none"
            >
              Administrar cuentas
            </button>
          )}
          {irBitacora && usuario.rol === 'administrador' && (
            <button
              type="button"
              onClick={irBitacora}
              className="flex h-[58px] w-full cursor-pointer items-center justify-center rounded-[10px] border-2 border-azul-idmz bg-white text-[17px] font-semibold text-[#174ea6] hover:bg-[#eef4ff] focus-visible:ring-[3px] focus-visible:ring-turquesa/45 focus-visible:outline-none"
            >
              Bitácora de seguridad
            </button>
          )}
          {irEstado && (
            <button
              type="button"
              onClick={irEstado}
              className="flex h-[58px] w-full cursor-pointer items-center justify-center rounded-[10px] border-2 border-azul-idmz bg-white text-[17px] font-semibold text-[#174ea6] hover:bg-[#eef4ff] focus-visible:ring-[3px] focus-visible:ring-turquesa/45 focus-visible:outline-none"
            >
              Estado del sistema
            </button>
          )}
          <button
            type="button"
            onClick={salir}
            disabled={cerrando}
            className="flex h-[58px] w-full cursor-pointer items-center justify-center rounded-[10px] border-2 border-azul-idmz bg-white text-[17px] font-semibold text-[#174ea6] hover:bg-[#eef4ff] focus-visible:ring-[3px] focus-visible:ring-turquesa/45 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-75"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </main>
  )
}
