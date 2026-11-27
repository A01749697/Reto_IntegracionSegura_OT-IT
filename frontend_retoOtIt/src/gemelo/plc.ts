// Los dos PLC simulados, cada uno como máquina de estados.
// Leen las entradas de las señales y escriben sus salidas, igual que lo harían los programas reales.
//   - Pistones (S7-1516): trabajan con marcha (torreta en verde). Solo en simulación:
//     en vivo los pistones siguen al paso real (ver seguidor.ts).
//   - Garra (S7-300): no depende de la torreta; atiende el depósito cuando LS-4 ve una pieza.
import { ESTADOS_TORRETA } from './nodos'
import { CARRILES_DE, PIEZAS_POR_CARRIL } from './medidas'
import type { Trabajo } from './garraReal'
import type { Carril } from './planta'
import type { Senales } from './senales'

export type EstadoPistones =
  | 'REPOSO'
  | 'A_EXT' // el alimentador empuja una pieza a la guia
  | 'A_RET' // regresa; la pieza baja sola y pasa por los sensores hasta el tope
  | 'SUJETA'
  | 'MARCA'
  | 'MARCA_ESPERA'
  | 'MARCA_SUBE'
  | 'SUELTA'
  | 'ESPERA_DEPOSITO' // no suelta la pieza mientras el deposito este ocupado
  | 'ABRE_TOPE' // baja el tope y la pieza cae al deposito

export type EstadoGarra =
  | 'REPOSO'
  | 'Z_BAJA'
  | 'CIERRA'
  | 'Z_SUBE'
  | 'X_IR'
  | 'Z_BAJA2'
  | 'ABRE'
  | 'Z_SUBE2'
  | 'VUELVE'

type Maquina<E> = { estado: E; t: number } // t: segundos en el estado actual

export type Plc = {
  pistones: Maquina<EstadoPistones> & {
    vioPieza: boolean
    esMetal: boolean
  }
  garra: Maquina<EstadoGarra> & {
    inicioCiclo: number
    // cuál de sus dos carriles está llenando cada material (0 o 1) y cuántas lleva en él
    carril: { al: number; pl: number }
    puestas: { al: number; pl: number }
    // en vivo: lo que hizo la garra real; la del gemelo los hace en orden
    porTrabajos: boolean
    trabajos: Trabajo[]
    trabajo: Trabajo | null
  }
  reloj: number
  ciclos: number // piezas que han empezado en los pistones
}

// a que paso de la secuencia corresponde cada estado
const PASO_PISTONES: Partial<Record<EstadoPistones, number>> = {
  A_EXT: 1,
  A_RET: 2,
  SUJETA: 3,
  MARCA: 3,
  MARCA_ESPERA: 3,
  MARCA_SUBE: 3,
  SUELTA: 3,
  ESPERA_DEPOSITO: 4,
  ABRE_TOPE: 4,
}

const PASO_GARRA: Partial<Record<EstadoGarra, number>> = {
  Z_BAJA: 5,
  CIERRA: 5,
  Z_SUBE: 5,
  X_IR: 6,
  Z_BAJA2: 6,
  ABRE: 6,
  Z_SUBE2: 6,
  VUELVE: 6,
}

// La pieza tarda un poco en asentarse en el deposito antes de que la garra baje.
const ASENTAR_SEGUNDOS = 0.35

export function crearPlc(): Plc {
  return {
    pistones: { estado: 'REPOSO', t: 0, vioPieza: false, esMetal: false },
    garra: {
      estado: 'REPOSO',
      t: 0,
      inicioCiclo: 0,
      carril: { al: 0, pl: 0 },
      puestas: { al: 0, pl: 0 },
      porTrabajos: false,
      trabajos: [],
      trabajo: null,
    },
    reloj: 0,
    ciclos: 0,
  }
}

export function irA<E>(maquina: Maquina<E>, estado: E) {
  maquina.estado = estado
  maquina.t = 0
}

export function apagarSalidas(s: Senales) {
  s.yA = s.yB = s.yC = s.yT = s.yZ = s.yG = false
  s.posX = 0
}

export function reiniciarPlc(plc: Plc) {
  irA(plc.pistones, 'REPOSO')
  irA(plc.garra, 'REPOSO')
  plc.garra.carril = { al: 0, pl: 0 }
  plc.garra.puestas = { al: 0, pl: 0 }
  plc.garra.porTrabajos = false
  plc.garra.trabajos = []
  plc.garra.trabajo = null
}

function empezarPistones(plc: Plc) {
  plc.ciclos++
  irA(plc.pistones, 'A_EXT')
}

function avanzarPistones(plc: Plc, s: Senales) {
  const p = plc.pistones
  // SC-1 dice que hay pieza; SI-1, que es de metal
  const identificar = () => {
    if (!s.sc1) return
    p.vioPieza = true
    if (s.si1) p.esMetal = true
  }

  switch (p.estado) {
    case 'REPOSO':
      s.yA = s.yB = s.yC = s.yT = false
      if (s.marcha) empezarPistones(plc)
      break
    case 'A_EXT':
      s.yA = true
      p.vioPieza = p.esMetal = false
      s.material = ''
      if (s.ls2) irA(p, 'A_RET')
      break
    case 'A_RET': // SC-2: la pieza llego al tope del marcado
      s.yA = false
      identificar()
      if (s.sc2 && s.ls1) {
        s.material = p.vioPieza ? (p.esMetal ? 'al' : 'pl') : ''
        irA(p, 'SUJETA')
      }
      break
    case 'SUJETA': // LS-3 confirma que la pieza quedo sujeta
      s.yB = p.t > 0.1
      if (s.ls3) irA(p, 'MARCA')
      break
    case 'MARCA':
      s.yC = true
      if (s.c1) irA(p, 'MARCA_ESPERA')
      break
    case 'MARCA_ESPERA':
      if (p.t > 0.25) irA(p, 'MARCA_SUBE')
      break
    case 'MARCA_SUBE': // el marcador regresa por resorte
      s.yC = false
      if (p.t > 0.4) irA(p, 'SUELTA')
      break
    case 'SUELTA':
      s.yB = false
      if (s.b0) irA(p, 'ESPERA_DEPOSITO')
      break
    case 'ESPERA_DEPOSITO':
      if (!s.ls4) irA(p, 'ABRE_TOPE')
      break
    case 'ABRE_TOPE': // la pieza ya salio del marcado: el tope vuelve a subir
      s.yT = true
      if (!s.sc2 && p.t > 0.45) {
        s.yT = false
        s.material = ''
        if (s.marcha) empezarPistones(plc)
        else irA(p, 'REPOSO')
      }
      break
  }
  s.paso = PASO_PISTONES[p.estado] ?? 0
}

function avanzarGarra(plc: Plc, s: Senales, carriles: readonly Carril[]) {
  const g = plc.garra
  switch (g.estado) {
    case 'REPOSO':
      s.yZ = s.yG = false
      s.posX = 0
      s.materialGarra = ''
      // LS-4: hay pieza; SI-2: el carro esta en el deposito; Z0: el eje Z arriba
      // en vivo solo trabaja cuando la garra real hizo algo
      if (
        s.ls4 &&
        s.si2 &&
        s.z0 &&
        g.t > ASENTAR_SEGUNDOS &&
        (!g.porTrabajos || g.trabajos.length > 0)
      ) {
        g.inicioCiclo = plc.reloj
        g.trabajo = g.porTrabajos ? (g.trabajos.shift() ?? null) : null
        s.materialGarra = g.trabajo ? g.trabajo.material : s.si3 ? 'al' : 'pl'
        irA(g, 'Z_BAJA')
      }
      if (!s.ls4) g.t = 0
      break
    case 'Z_BAJA':
      s.yZ = true
      if (s.z1) irA(g, 'CIERRA')
      break
    case 'CIERRA':
      s.yG = true
      if (g.t > 0.3) irA(g, 'Z_SUBE')
      break
    case 'Z_SUBE':
      s.yZ = false
      if (s.z0) {
        // pone 4 en un carril de su material y luego 4 en el otro: 4, 4, 4, 4
        // el carril que usó la garra real; si no se sabe, 4 en uno y 4 en el otro
        const material = s.materialGarra === 'al' ? 'al' : 'pl'
        s.posX =
          g.trabajo?.canal || CARRILES_DE[material][g.carril[material]] + 1
        irA(g, 'X_IR')
      }
      break
    case 'X_IR': // espera a que el carro llegue y a que el carril tenga lugar
      if (g.t > 0.1 && s.xOk && carriles[s.posX - 1].piezas < PIEZAS_POR_CARRIL)
        irA(g, 'Z_BAJA2')
      break
    case 'Z_BAJA2':
      s.yZ = true
      if (s.z1) irA(g, 'ABRE')
      break
    case 'ABRE':
      s.yG = false
      if (g.t > 0.3) {
        if (s.materialGarra === 'al') s.piezasAl++
        else s.piezasPl++
        const material = s.materialGarra === 'al' ? 'al' : 'pl'
        if (++g.puestas[material] >= PIEZAS_POR_CARRIL) {
          g.puestas[material] = 0
          g.carril[material] = 1 - g.carril[material]
        }
        irA(g, 'Z_SUBE2')
      }
      break
    case 'Z_SUBE2':
      s.yZ = false
      if (s.z0) {
        s.tCiclo = plc.reloj - g.inicioCiclo
        s.posX = 0
        irA(g, 'VUELVE')
      }
      break
    case 'VUELVE':
      if (g.t > 0.1 && s.xOk) irA(g, 'REPOSO')
      break
  }
  s.pasoGarra = PASO_GARRA[g.estado] ?? 0
}

export function avanzarPlc(
  plc: Plc,
  s: Senales,
  carriles: readonly Carril[],
  dt: number,
  conPistones = true,
  conGarra = true,
) {
  plc.reloj += dt
  plc.pistones.t += dt
  plc.garra.t += dt

  if (conPistones) avanzarPistones(plc, s)
  if (conGarra) avanzarGarra(plc, s, carriles)

  // una luz a la vez según TAB_TORRETA; el reset parpadea en amarillo a 1 Hz
  const parpadeo = plc.reloj % 1 < 0.5
  s.torreVerde = s.torreta === ESTADOS_TORRETA.verde
  s.torreAmarilla =
    s.torreta === ESTADOS_TORRETA.amarilla ||
    (s.torreta === ESTADOS_TORRETA.reset && parpadeo)
  s.torreRoja = s.torreta === ESTADOS_TORRETA.roja
}
