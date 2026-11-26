// Números que se pueden ajustar sin tocar el resto del código.

const MINUTO = 60 * 1000
const HORA = 60 * MINUTO

export const seguridad = {
  reinicio: {
    duracionEnlaceMs: 10 * MINUTO,
  },
  sesion: {
    nombreCookie: '__Host-sesion',
    inactividadMaximaMs: 30 * MINUTO,
    duracionMaximaMs: 8 * HORA,
  },
  bloqueo: {
    intentosMaximos: 3,
    duracionMs: 15 * MINUTO,
  },
  contrasena: {
    largoMinimo: 12,
    largoMaximo: 128,
  },
  limitador: {
    ventanaMs: 15 * MINUTO,
    maximoPorIp: 20,
  },
  lecturas: {
    maximoPuntosHistorial: 1000,
    // indicadores: lo más que se lee de un nodo y lo más largo que se puede pedir
    maximoPuntosIndicadores: 300_000,
    maximoDiasIndicadores: 93,
    maximoCubetasIndicadores: 100,
  },
  sistema: {
    // pasado este tiempo sin lecturas nuevas, el estado dice "retrasado"
    lecturaRetrasadaSegundos: 5 * 60,
    // historial de disponibilidad: la ventana se parte en cubetas del mismo tamaño
    // (24 h = 96 cubetas de 15 min, 7 días = 84 cubetas de 2 h)
    disponibilidad: {
      '24h': { cubetaSegundos: 15 * 60, cantidad: 96 },
      '7d': { cubetaSegundos: 2 * 60 * 60, cantidad: 84 },
    },
    // cuántas interrupciones se listan (las más recientes primero)
    maximoCortes: 10,
    // cuánto se espera a que responda la API receptora antes de darla por caída
    esperaSondaMs: 3000,
  },
  bitacora: {
    porDefecto: 50,
    maximo: 100,
    // tope de filas del archivo CSV
    maximoExportacion: 5000,
  },
  datos: {
    porDefecto: 50,
    maximo: 100,
    largoMaximoBusqueda: 60,
  },
  peticion: {
    limiteCuerpo: '10kb',
  },
} as const
