import type { Seccion } from '../panel/EncabezadoPanel'

// A donde apunta la direccion del navegador.
// 'raiz' es la portada sin sesion y el inicio del panel con sesion.
export type Destino =
  | { donde: 'raiz' }
  | { donde: 'publica'; pagina: 'login' | 'crear' }
  | { donde: 'panel'; seccion: Exclude<Seccion, 'inicio'> }
  | { donde: 'desconocida' }

export const RAIZ: Destino = { donde: 'raiz' }

// Lo que va despues de "#/" para cada pantalla.
const TRAMOS: Record<string, Destino> = {
  entrar: { donde: 'publica', pagina: 'login' },
  'crear-cuenta': { donde: 'publica', pagina: 'crear' },
  cuentas: { donde: 'panel', seccion: 'cuentas' },
  bitacora: { donde: 'panel', seccion: 'bitacora' },
  datos: { donde: 'panel', seccion: 'datos' },
  estado: { donde: 'panel', seccion: 'estado' },
  indicadores: { donde: 'panel', seccion: 'indicadores' },
  tablero: { donde: 'panel', seccion: 'tablero' },
  gemelo: { donde: 'panel', seccion: 'gemelo' },
  'mi-cuenta': { donde: 'panel', seccion: 'cuenta' },
  ayuda: { donde: 'panel', seccion: 'ayuda' },
}

const igual = (a: Destino, b: Destino) =>
  JSON.stringify(a) === JSON.stringify(b)

export function leerDestino(ubicacion: {
  pathname: string
  hash: string
}): Destino {
  // el servidor solo entrega la pagina en la raiz
  if (ubicacion.pathname !== '/' && ubicacion.pathname !== '/index.html') {
    return { donde: 'desconocida' }
  }
  // solo "#/algo" es una pantalla; otro "#" (como el del enlace del correo) no
  if (!ubicacion.hash.startsWith('#/')) return RAIZ
  const tramo = ubicacion.hash.slice(2).replace(/\/+$/, '')
  if (tramo === '') return RAIZ
  return Object.hasOwn(TRAMOS, tramo) ? TRAMOS[tramo] : { donde: 'desconocida' }
}

export function direccionDe(destino: Destino): string {
  const tramo = Object.keys(TRAMOS).find((clave) =>
    igual(TRAMOS[clave], destino),
  )
  return tramo ? `/#/${tramo}` : '/'
}

export const destinoDeSeccion = (seccion: Seccion): Destino =>
  seccion === 'inicio' ? RAIZ : { donde: 'panel', seccion }
