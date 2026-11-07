import type { ReactNode } from 'react'

type Props = {
  titulo: string
  volver: () => void
  children: ReactNode
}

export default function MarcoPanel({ titulo, volver, children }: Props) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#dbe8fd] bg-[linear-gradient(120deg,#b3cff9_0%,#dbe8fd_45%,#f6f9ff_100%)] px-4 py-12 font-sans text-tinta">
      <div className="w-full max-w-[720px] overflow-hidden rounded-[18px] border border-borde bg-white shadow-[0_18px_40px_rgba(11,47,107,0.2)]">
        <div className="flex items-center justify-between gap-4 border-b-4 border-turquesa bg-[linear-gradient(135deg,#0b2f6b_0%,#1f5fd0_100%)] px-6 py-[30px] sm:px-10">
          <h1 className="text-[26px] leading-tight font-bold text-white">
            {titulo}
          </h1>
          <button
            type="button"
            onClick={volver}
            className="h-11 cursor-pointer rounded-lg border border-white/50 px-4 text-[15px] font-semibold text-white hover:bg-white/15 focus-visible:ring-[3px] focus-visible:ring-white/60 focus-visible:outline-none"
          >
            Volver
          </button>
        </div>
        <div className="flex flex-col gap-6 px-6 pt-8 pb-10 sm:px-10">
          {children}
        </div>
      </div>
    </main>
  )
}
