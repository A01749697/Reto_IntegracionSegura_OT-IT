// Medidas de la celda en metros. El origen es la superficie de la mesa.
// Las usan la planta (para mover las piezas) y la escena (para dibujarlas).

export type P3 = [number, number, number]

export const ALTURA_MESA = 0.8

// banda transportadora
export const Z_BANDA = -0.08 // linea central
export const Y_BANDA = 0.2
export const Y_PIEZA = Y_BANDA + 0.025 // centro de una pieza sobre la banda
export const BANDA_X0 = -0.58
export const BANDA_X1 = 0.4
export const LARGO_BANDA = BANDA_X1 - BANDA_X0
export const VELOCIDAD_BANDA = 0.22

// estaciones a lo largo de la banda
export const X_ALMACEN = -0.66
export const X_IDENTIFICACION = -0.3
export const X_MARCADO = 0.02
export const X_TOMA = 0.36

// portico
export const CARRILES = [0.56, 0.645, 0.73, 0.815] // 1-2 plastico, 3-4 aluminio
export const PARADAS_CARRO = [X_TOMA, ...CARRILES] // 0 = toma
export const Y_PINZA_ARRIBA = 0.37
export const Z_PORTICO = -0.25

// carreras de los cilindros
export const CARRERA = { A: 0.165, B: 0.05, C: 0.08, Z: 0.145 }

// rampa de carriles
export const RAMPA = { z0: -0.125, y0: 0.21, z1: 0.15, pendiente: 0.09 / 0.275 }
export const alturaCarril = (z: number) =>
  RAMPA.y0 - (z - RAMPA.z0) * RAMPA.pendiente

// cajas de empaque: la 0 es de plastico y la 1 de aluminio
export const CAJA_X = [0.6025, 0.7725]
export const CAJA_Y = 0.034
export const CAJA_Z = 0.235
export const PIEZAS_POR_CAJA = 4
export const CAJAS_POR_TARIMA = 12

export const TOTAL_PIEZAS = 12
export const PIEZAS_VISIBLES_ALMACEN = 6
