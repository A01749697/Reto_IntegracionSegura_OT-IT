// Las señales de la celda, con los nombres que tienen en el PLC.
// La planta y la escena solo leen de aquí; el PLC simulado es quien las escribe.

export type Material = '' | 'al' | 'pl'

export type Senales = {
  marcha: boolean
  emergencia: boolean
  // salidas
  yA: boolean // V1: alimentador
  yB: boolean // V2: sujecion
  yC: boolean // V3: marcador
  yZ: boolean // portico: bajar el eje Z
  yG: boolean // portico: cerrar la pinza
  motorBanda: boolean
  posX: number // 0 = toma, 1-2 = carriles de plastico, 3-4 = carriles de aluminio
  torreVerde: boolean
  torreAmarilla: boolean
  torreRoja: boolean
  // entradas
  ls1: boolean
  ls2: boolean
  ls3: boolean
  ls4: boolean
  sc1: boolean
  sc2: boolean
  si1: boolean
  si2: boolean
  b0: boolean
  c1: boolean
  z0: boolean
  z1: boolean
  xOk: boolean
  // valores
  material: Material
  posMm: number
  piezasAl: number
  piezasPl: number
  cajasAl: number
  cajasPl: number
  tCiclo: number
  presion: number
  paso: number // 0 = reposo, 1 a 6 = paso de la secuencia
}

export function senalesIniciales(): Senales {
  return {
    marcha: false,
    emergencia: false,
    yA: false,
    yB: false,
    yC: false,
    yZ: false,
    yG: false,
    motorBanda: false,
    posX: 0,
    torreVerde: false,
    torreAmarilla: true,
    torreRoja: false,
    ls1: true,
    ls2: false,
    ls3: false,
    ls4: false,
    sc1: false,
    sc2: false,
    si1: false,
    si2: true,
    b0: true,
    c1: false,
    z0: true,
    z1: false,
    xOk: true,
    material: '',
    posMm: 0,
    piezasAl: 0,
    piezasPl: 0,
    cajasAl: 0,
    cajasPl: 0,
    tCiclo: 0,
    presion: 6,
    paso: 0,
  }
}

// Las señales de encendido y apagado, que son las que tienen foco en la pantalla.
export type SenalDigital = {
  [K in keyof Senales]: Senales[K] extends boolean ? K : never
}[keyof Senales]

export type Tono = 'ok' | 'acento' | 'aviso' | 'alerta'

export type FilaSenal = { clave: SenalDigital; nombre: string; tono: Tono }

export const SALIDAS: FilaSenal[] = [
  { clave: 'yA', nombre: 'Alimentador empuja', tono: 'acento' },
  { clave: 'yB', nombre: 'Sujeción cierra', tono: 'acento' },
  { clave: 'yC', nombre: 'Marcador baja', tono: 'acento' },
  { clave: 'motorBanda', nombre: 'Motor de la banda', tono: 'acento' },
  { clave: 'yZ', nombre: 'Pórtico baja', tono: 'acento' },
  { clave: 'yG', nombre: 'Pinza cierra', tono: 'acento' },
  { clave: 'torreVerde', nombre: 'Torreta verde', tono: 'ok' },
  { clave: 'torreAmarilla', nombre: 'Torreta amarilla', tono: 'aviso' },
  { clave: 'torreRoja', nombre: 'Torreta roja', tono: 'alerta' },
]

export const ENTRADAS: FilaSenal[] = [
  { clave: 'ls1', nombre: 'Alimentador atrás', tono: 'ok' },
  { clave: 'ls2', nombre: 'Alimentador adelante', tono: 'ok' },
  { clave: 'sc1', nombre: 'Hay pieza', tono: 'ok' },
  { clave: 'si1', nombre: 'La pieza es metal', tono: 'ok' },
  { clave: 'sc2', nombre: 'Pieza en marcado', tono: 'ok' },
  { clave: 'b0', nombre: 'Sujeción abierta', tono: 'ok' },
  { clave: 'ls3', nombre: 'Pieza sujeta', tono: 'ok' },
  { clave: 'c1', nombre: 'Marcador abajo', tono: 'ok' },
  { clave: 'ls4', nombre: 'Pieza en el tope', tono: 'ok' },
  { clave: 'si2', nombre: 'Carro en la toma', tono: 'ok' },
  { clave: 'z0', nombre: 'Eje Z arriba', tono: 'ok' },
  { clave: 'z1', nombre: 'Eje Z abajo', tono: 'ok' },
  { clave: 'xOk', nombre: 'Carro en posición', tono: 'ok' },
  { clave: 'emergencia', nombre: 'Paro de emergencia', tono: 'alerta' },
]

export const PASOS = [
  'Alimentar',
  'Identificar',
  'Sujetar y marcar',
  'Llevar a toma',
  'Tomar',
  'Clasificar',
  'Empacar',
]
