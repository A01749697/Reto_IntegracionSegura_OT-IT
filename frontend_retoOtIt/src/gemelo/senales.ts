// Las señales de la celda, con los nombres que tienen en el PLC.
// La planta y la escena solo leen de aquí; los PLC simulados son quienes las escriben.
//
// Son dos procesos que no se hablan entre sí:
//   - Pistones (tablero neumático, S7-1516): alimentar, identificar, sujetar, marcar y soltar
//     la pieza al depósito. Arranca con la torreta en verde y se detiene en rojo (S7-1200).
//   - Garra (estación Amatrol, S7-300): no tiene torreta. Trabaja sola cada vez que su
//     sensor ve una pieza en el depósito (LS-4) y con su propio sensor de metal (SI-3)
//     decide a qué carril va. El depósito es lo único que une a los dos.

export type Material = '' | 'al' | 'pl'

export type Senales = {
  marcha: boolean // torreta en verde: el proceso de pistones puede trabajar
  // salidas
  yA: boolean // V1: alimentador
  yB: boolean // V2: sujecion
  yC: boolean // V3: marcador
  yT: boolean // V4: baja el tope y la pieza sigue hacia el deposito
  yZ: boolean // garra: bajar el eje Z
  yG: boolean // garra: cerrar la pinza
  posX: number // 0 = deposito, 1-2 = carriles de aluminio, 3-4 = carriles de plastico
  torreVerde: boolean
  torreRoja: boolean
  // entradas
  ls1: boolean
  ls2: boolean
  ls3: boolean
  ls4: boolean // hay pieza en el deposito
  sc1: boolean
  sc2: boolean
  si1: boolean
  si2: boolean
  si3: boolean // la pieza del deposito es metal (sensor de la garra)
  b0: boolean
  c1: boolean
  z0: boolean
  z1: boolean
  xOk: boolean
  // valores
  material: Material // lo que identificaron los pistones
  materialGarra: Material // lo que lleva la garra
  posMm: number
  piezasAl: number
  piezasPl: number
  cajasAl: number
  cajasPl: number
  tCiclo: number
  presion: number
  paso: number // pistones: 0 = reposo, 1 a 4
  pasoGarra: number // garra: 0 = reposo, 5 o 6
  pasoReal: number | null // en vivo: TAB_PASO que el gemelo está mostrando
}

export function senalesIniciales(): Senales {
  return {
    marcha: false,
    yA: false,
    yB: false,
    yC: false,
    yT: false,
    yZ: false,
    yG: false,
    posX: 0,
    torreVerde: false,
    torreRoja: true,
    ls1: true,
    ls2: false,
    ls3: false,
    ls4: false,
    sc1: false,
    sc2: false,
    si1: false,
    si2: true,
    si3: false,
    b0: true,
    c1: false,
    z0: true,
    z1: false,
    xOk: true,
    material: '',
    materialGarra: '',
    posMm: 0,
    piezasAl: 0,
    piezasPl: 0,
    cajasAl: 0,
    cajasPl: 0,
    tCiclo: 0,
    presion: 6,
    paso: 0,
    pasoGarra: 0,
    pasoReal: null,
  }
}

// Las señales de encendido y apagado, que son las que tienen foco en la pantalla.
export type SenalDigital = {
  [K in keyof Senales]: Senales[K] extends boolean ? K : never
}[keyof Senales]

export type Tono = 'ok' | 'acento' | 'aviso' | 'alerta'

export type FilaSenal = { clave: SenalDigital; tono: Tono }

export const SALIDAS: FilaSenal[] = [
  { clave: 'yA', tono: 'acento' },
  { clave: 'yB', tono: 'acento' },
  { clave: 'yC', tono: 'acento' },
  { clave: 'yT', tono: 'acento' },
  { clave: 'yZ', tono: 'acento' },
  { clave: 'yG', tono: 'acento' },
  { clave: 'torreVerde', tono: 'ok' },
  { clave: 'torreRoja', tono: 'alerta' },
]

export const ENTRADAS: FilaSenal[] = [
  { clave: 'ls1', tono: 'ok' },
  { clave: 'ls2', tono: 'ok' },
  { clave: 'sc1', tono: 'ok' },
  { clave: 'si1', tono: 'ok' },
  { clave: 'sc2', tono: 'ok' },
  { clave: 'b0', tono: 'ok' },
  { clave: 'ls3', tono: 'ok' },
  { clave: 'c1', tono: 'ok' },
  { clave: 'ls4', tono: 'ok' },
  { clave: 'si3', tono: 'ok' },
  { clave: 'si2', tono: 'ok' },
  { clave: 'z0', tono: 'ok' },
  { clave: 'z1', tono: 'ok' },
  { clave: 'xOk', tono: 'ok' },
]

// Los nombres de los pasos están en los diccionarios de idioma (gemelo.pasos).
// Del 1 al 4 son de los pistones, 5 y 6 de la garra y 7 es el empaque.
export const CLAVES_PASOS = [
  'alimentar',
  'identificar',
  'sujetarMarcar',
  'soltarDeposito',
  'tomar',
  'clasificar',
  'empacar',
] as const
