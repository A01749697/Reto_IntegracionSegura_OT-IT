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
  },
  peticion: {
    limiteCuerpo: '10kb',
  },
} as const
