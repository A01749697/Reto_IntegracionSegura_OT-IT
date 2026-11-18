import { useEffect, useRef, useState } from 'react'
import { crearEscena, type Escena } from './escena'
import type { Gemelo, Mando } from './gemelo'
import type { Vista } from './vistas'

type Props = {
  gemelo: Gemelo
  vista: Vista
  conEtiquetas: boolean
  obstaculos: () => DOMRect[]
  alRefrescar: () => void
  alPulsar: (mando: Mando) => void
}

// Se prueba en un lienzo aparte y se suelta el contexto para no gastar uno de mas.
function hayWebGL(): boolean {
  try {
    const contexto = document.createElement('canvas').getContext('webgl2')
    contexto?.getExtension('WEBGL_lose_context')?.loseContext()
    return contexto !== null && contexto !== undefined
  } catch {
    return false
  }
}

// El lienzo 3D de la celda. Se carga aparte porque three.js pesa bastante.
export default function VistaCelda({
  gemelo,
  vista,
  conEtiquetas,
  obstaculos,
  alRefrescar,
  alPulsar,
}: Props) {
  const lienzo = useRef<HTMLCanvasElement>(null)
  const capa = useRef<HTMLDivElement>(null)
  const escena = useRef<Escena | null>(null)
  const [sinWebGL] = useState(() => !hayWebGL())

  useEffect(() => {
    if (sinWebGL || !lienzo.current || !capa.current) return
    try {
      escena.current = crearEscena({
        lienzo: lienzo.current,
        capaEtiquetas: capa.current,
        gemelo,
        obstaculos,
        alRefrescar,
        alPulsar,
      })
    } catch {
      // la tarjeta grafica no respondio: la vista queda vacia y lo demas sigue
      return
    }
    return () => {
      escena.current?.destruir()
      escena.current = null
    }
  }, [sinWebGL, gemelo, obstaculos, alRefrescar, alPulsar])

  useEffect(() => {
    escena.current?.irAVista(vista)
  }, [vista])

  useEffect(() => {
    escena.current?.mostrarEtiquetas(conEtiquetas)
  }, [conEtiquetas])

  if (sinWebGL) {
    return (
      <p
        role="alert"
        className="flex h-full items-center justify-center px-6 text-center text-[14px] text-white"
      >
        Este navegador no pudo abrir la vista 3D.
      </p>
    )
  }

  return (
    <>
      <canvas
        ref={lienzo}
        aria-label="Vista 3D de la celda clasificadora"
        className="absolute inset-0 block h-full w-full touch-none"
      />
      <div
        ref={capa}
        className="pointer-events-none absolute inset-0 overflow-hidden"
      />
    </>
  )
}
