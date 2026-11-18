import type { P3 } from './medidas'

// Encuadres de la cámara: desde dónde mira y hacia qué punto.
export const VISTAS = {
  General: { desde: [2.25, 1.95, 2.9], hacia: [0.15, 0.95, 0] },
  Planta: { desde: [4.6, 3.1, 5.6], hacia: [0, 1.2, -0.6] },
  Alimentador: { desde: [-1.45, 1.5, 0.85], hacia: [-0.66, 1.08, -0.08] },
  Sensores: { desde: [-0.05, 1.45, 0.7], hacia: [-0.3, 1.05, -0.08] },
  Marcado: { desde: [0.5, 1.45, 0.7], hacia: [0.02, 1.07, -0.1] },
  Pórtico: { desde: [1.3, 1.75, 1], hacia: [0.58, 1.12, -0.05] },
  Empaque: { desde: [1.75, 1.45, 1.25], hacia: [0.85, 0.75, 0.25] },
  Tablero: { desde: [-0.45, 1.3, 0.85], hacia: [-0.4, 1.03, -0.44] },
} satisfies Record<string, { desde: P3; hacia: P3 }>

export type Vista = keyof typeof VISTAS

export const NOMBRES_VISTAS = Object.keys(VISTAS) as Vista[]
