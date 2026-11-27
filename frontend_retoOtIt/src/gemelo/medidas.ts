// Medidas de la celda en metros. El origen es la superficie de la mesa.
// Las usan la planta (para mover las piezas) y la escena (para dibujarlas).

export type P3 = [number, number, number]

export const ALTURA_MESA = 0.8

// Ya no hay banda: la pieza baja sola por una guía inclinada y cae a un depósito,
// de donde la toma la garra. La guía es plana bajo el almacén y luego tiene pendiente.
export const Z_LINEA = -0.08 // linea central de la guia y del deposito
export const Y_GUIA = 0.2725 // superficie de la guia bajo el almacen
export const GUIA_X0 = -0.58 // aqui empieza la pendiente
export const GUIA_X1 = 0.27 // aqui termina la guia: la pieza cae al deposito
export const PENDIENTE_GUIA = 0.05
export const ACELERACION_GUIA = 1.1 // m/s² de la pieza al bajar
export const VELOCIDAD_MAXIMA_GUIA = 0.32

export function yGuia(x: number): number {
  const recorrido = Math.min(Math.max(x, GUIA_X0), GUIA_X1) - GUIA_X0
  return Y_GUIA - recorrido * PENDIENTE_GUIA
}
// centro de una pieza apoyada en la guia
export const yPiezaEn = (x: number) => yGuia(x) + 0.025
export const Y_PIEZA = Y_GUIA + 0.025 // pieza bajo el almacen y frente al alimentador

// estaciones a lo largo de la guia
export const X_ALMACEN = -0.66
export const X_IDENTIFICACION = -0.3
export const X_MARCADO = 0.02
export const X_TOPE = X_MARCADO + 0.034 // tope que detiene la pieza en el marcado

// deposito: hueco al final de la guia donde la garra toma la pieza
export const X_TOMA = 0.36
export const Y_DEPOSITO = 0.2 // fondo del deposito
export const Y_PIEZA_TOMA = Y_DEPOSITO + 0.025

// portico (la garra)
export const CARRILES = [0.56, 0.645, 0.73, 0.815] // 1-2 aluminio, 3-4 plastico
// Qué carriles (índice en CARRILES) son de cada material. Se llena uno hasta tener
// PIEZAS_POR_CARRIL y luego el otro: 4, 4, 4, 4.
export const CARRILES_DE = { al: [0, 1], pl: [2, 3] } as const
export const PIEZAS_POR_CARRIL = 4
// distancia entre piezas formadas en un carril, sobre la rampa
export const PASO_EN_CARRIL = 0.055
export const PARADAS_CARRO = [X_TOMA, ...CARRILES] // 0 = toma
export const Y_PINZA_ARRIBA = 0.37
export const Z_PORTICO = -0.25

// carreras de los cilindros (T es el tope del marcado)
export const CARRERA = { A: 0.165, B: 0.05, C: 0.08, Z: 0.145, T: 0.035 }

// rampa de carriles
export const RAMPA = { z0: -0.125, y0: 0.21, z1: 0.15, pendiente: 0.09 / 0.275 }
export const alturaCarril = (z: number) =>
  RAMPA.y0 - (z - RAMPA.z0) * RAMPA.pendiente

// Banda de salida: cuando un carril junta sus 4 piezas las suelta aquí, una por una, y la
// banda las lleva a la estación de empaque al final de la mesa.
export const BANDA = {
  x0: 0.47,
  x1: 0.84,
  z: 0.235,
  y: 0.045, // superficie
  ancho: 0.085,
  velocidad: 0.16, // m/s
}
export const Y_PIEZA_BANDA = BANDA.y + 0.025
// cada cuánto suelta un carril la siguiente pieza (s)
export const SOLTAR_CADA = 0.5

// Cajas de empaque a los lados del final de la banda: la 0 de aluminio, la 1 de plástico.
// El desviador manda cada pieza a la de su material.
export const CAJAS = [
  { x: 0.92, z: 0.1 },
  { x: 0.92, z: 0.37 },
] as const
export const CAJA_Y = 0.005
// altura a la que el desviador pasa la pieza por encima de la pared de la caja
export const Y_PASO_CAJA = 0.115
export const PIEZAS_POR_CAJA = 4
export const CAJAS_POR_TARIMA = 12

// los carriles llegan a guardar 16 piezas: con menos, el almacén se quedaría vacío
export const TOTAL_PIEZAS = 28
export const PIEZAS_VISIBLES_ALMACEN = 6
