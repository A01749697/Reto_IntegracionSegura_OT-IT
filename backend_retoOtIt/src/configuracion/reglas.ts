// Reglas de lo que la API receptora acepta.
// Este es el archivo que se edita cuando el profesor defina las variables del
// proyecto: se agregan o se quitan nombres de la lista y no se toca la base de datos.

export const PLC_PERMITIDOS = ['S7-1200', 'S7-1500'] as const

export const VARIABLES_PERMITIDAS = [
  'estado_estacion',
  'estado_piston',
  'presencia_pieza',
  'contador_piezas',
] as const

export const MAXIMO_LECTURAS_POR_ENVIO = 500
export const LIMITE_CUERPO = '100kb'
export const VALOR_ABSOLUTO_MAXIMO = 1e12
export const VENTANA_PASADO_MS = 7 * 24 * 60 * 60 * 1000
export const VENTANA_FUTURO_MS = 5 * 60 * 1000
