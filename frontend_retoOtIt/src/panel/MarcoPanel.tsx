import type { ReactNode } from 'react'

type Props = {
  titulo: string
  children: ReactNode
}

// Zona de contenido de cada pantalla; el encabezado con la navegacion lo pone App.
export default function MarcoPanel({ titulo, children }: Props) {
  return (
    <main className="w-full px-4 py-7 sm:px-6">
      <h1 className="text-[28px] leading-tight font-bold tracking-tight">
        {titulo}
      </h1>
      <div className="mt-5 flex flex-col gap-5">{children}</div>
    </main>
  )
}
