import { useCallback, useEffect, useState } from 'react'
import { direccionDe, leerDestino, type Destino } from './rutas'

type Opciones = { reemplazar?: boolean }

// La pantalla actual sale de la direccion, asi funcionan Atras, Adelante y recargar.
export function useDestino() {
  const [destino, setDestino] = useState<Destino>(() =>
    leerDestino(window.location),
  )

  useEffect(() => {
    const leer = () => setDestino(leerDestino(window.location))
    window.addEventListener('popstate', leer)
    window.addEventListener('hashchange', leer)
    return () => {
      window.removeEventListener('popstate', leer)
      window.removeEventListener('hashchange', leer)
    }
  }, [])

  const navegar = useCallback((nuevo: Destino, opciones: Opciones = {}) => {
    const direccion = direccionDe(nuevo)
    const actual = window.location.pathname + window.location.hash
    if (direccion !== actual) {
      if (opciones.reemplazar) window.history.replaceState(null, '', direccion)
      else window.history.pushState(null, '', direccion)
    }
    setDestino(nuevo)
  }, [])

  return [destino, navegar] as const
}
