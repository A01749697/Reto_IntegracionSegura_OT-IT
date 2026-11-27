// La garra (estación Amatrol, S7-300), simulada en los dos modos como máquina de estados.
// No depende de la torreta: atiende el depósito cada vez que LS-4 ve una pieza y con SI-3
// decide a qué carril va. Los pistones son del S7-1516 (ver s7_1516.ts y actuadores.ts).
import { CARRILES_DE, PIEZAS_POR_CARRIL } from './medidas'
import type { Carril } from './planta'
import type { Senales } from './senales'

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
  garra: Maquina<EstadoGarra> & {
    inicioCiclo: number
    // cuál de sus dos carriles está llenando cada material (0 o 1) y cuántas lleva en él
    carril: { al: number; pl: number }
    puestas: { al: number; pl: number }
  }
  reloj: number
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
    garra: {
      estado: 'REPOSO',
      t: 0,
      inicioCiclo: 0,
      carril: { al: 0, pl: 0 },
      puestas: { al: 0, pl: 0 },
    },
    reloj: 0,
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
  irA(plc.garra, 'REPOSO')
  plc.garra.carril = { al: 0, pl: 0 }
  plc.garra.puestas = { al: 0, pl: 0 }
}

function avanzarGarra(plc: Plc, s: Senales, carriles: readonly Carril[]) {
  const g = plc.garra
  switch (g.estado) {
    case 'REPOSO':
      s.yZ = s.yG = false
      s.posX = 0
      s.materialGarra = ''
      // LS-4: hay pieza; SI-2: el carro esta en el deposito; Z0: el eje Z arriba
      if (s.ls4 && s.si2 && s.z0 && g.t > ASENTAR_SEGUNDOS) {
        g.inicioCiclo = plc.reloj
        s.materialGarra = s.si3 ? 'al' : 'pl'
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
        const material = s.materialGarra === 'al' ? 'al' : 'pl'
        s.posX = CARRILES_DE[material][g.carril[material]] + 1
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
) {
  plc.reloj += dt
  plc.garra.t += dt
  avanzarGarra(plc, s, carriles)
}
