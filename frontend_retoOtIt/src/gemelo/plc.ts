// PLC simulado: la secuencia de la celda como máquina de estados.
// Lee las entradas de las señales y escribe las salidas, igual que lo haría el programa real.
import type { Caja } from './planta'
import type { Senales } from './senales'

export type EstadoPlc =
  | 'REPOSO'
  | 'A_EXT'
  | 'A_RET'
  | 'A_IDENT'
  | 'A_MARCA'
  | 'SUJETA'
  | 'MARCA'
  | 'MARCA_ESPERA'
  | 'MARCA_SUBE'
  | 'SUELTA'
  | 'A_TOMA'
  | 'Z_BAJA'
  | 'CIERRA'
  | 'Z_SUBE'
  | 'X_IR'
  | 'Z_BAJA2'
  | 'ABRE'
  | 'Z_SUBE2'
  | 'VUELVE'
  | 'EMERGENCIA'

export type Plc = {
  estado: EstadoPlc
  t: number // segundos en el estado actual
  inicioCiclo: number
  reloj: number
  vioPieza: boolean
  esMetal: boolean
  aluminio: number
  plastico: number
  ciclos: number // ciclos que ha empezado
}

// a que paso de la secuencia (1 a 6) corresponde cada estado
const PASO: Partial<Record<EstadoPlc, number>> = {
  A_EXT: 1,
  A_RET: 1,
  A_IDENT: 2,
  A_MARCA: 3,
  SUJETA: 3,
  MARCA: 3,
  MARCA_ESPERA: 3,
  MARCA_SUBE: 3,
  SUELTA: 3,
  A_TOMA: 4,
  Z_BAJA: 5,
  CIERRA: 5,
  Z_SUBE: 5,
  X_IR: 6,
  Z_BAJA2: 6,
  ABRE: 6,
  Z_SUBE2: 6,
}

export function crearPlc(): Plc {
  return {
    estado: 'REPOSO',
    t: 0,
    inicioCiclo: 0,
    reloj: 0,
    vioPieza: false,
    esMetal: false,
    aluminio: 0,
    plastico: 0,
    ciclos: 0,
  }
}

export function irA(plc: Plc, estado: EstadoPlc) {
  plc.estado = estado
  plc.t = 0
}

function empezarCiclo(plc: Plc) {
  plc.inicioCiclo = plc.reloj
  plc.ciclos++
  irA(plc, 'A_EXT')
}

export function apagarSalidas(s: Senales) {
  s.motorBanda = s.yA = s.yB = s.yC = s.yZ = s.yG = false
  s.posX = 0
}

export function avanzarPlc(
  plc: Plc,
  s: Senales,
  cajas: readonly Caja[],
  dt: number,
) {
  plc.t += dt
  plc.reloj += dt

  if (s.emergencia) {
    plc.estado = 'EMERGENCIA'
    s.motorBanda = false
    s.torreVerde = false
    s.torreAmarilla = false
    s.torreRoja = (plc.reloj * 2.5) % 1 < 0.5 // parpadea
    s.paso = 0
    return
  }

  // SC-1 dice que hay pieza; SI-1, que es de metal
  const identificar = () => {
    if (!s.sc1) return
    plc.vioPieza = true
    if (s.si1) plc.esMetal = true
  }

  switch (plc.estado) {
    case 'REPOSO':
      apagarSalidas(s)
      if (s.marcha) empezarCiclo(plc)
      break
    case 'A_EXT':
      s.yA = true
      s.posX = 0
      plc.vioPieza = plc.esMetal = false
      s.material = ''
      if (s.ls2) irA(plc, 'A_RET')
      break
    case 'A_RET':
      s.yA = false
      s.motorBanda = true
      identificar()
      if (s.ls1) irA(plc, 'A_IDENT')
      break
    case 'A_IDENT':
      identificar()
      if (!s.sc1 && plc.vioPieza) {
        s.material = plc.esMetal ? 'al' : 'pl'
        irA(plc, 'A_MARCA')
      }
      break
    case 'A_MARCA': // SC-2 detiene la banda
      s.motorBanda = !s.sc2
      if (s.sc2) irA(plc, 'SUJETA')
      break
    case 'SUJETA': // LS-3 confirma que la pieza quedo sujeta
      s.motorBanda = false
      s.yB = plc.t > 0.1
      if (s.ls3) irA(plc, 'MARCA')
      break
    case 'MARCA':
      s.yC = true
      if (s.c1) irA(plc, 'MARCA_ESPERA')
      break
    case 'MARCA_ESPERA':
      if (plc.t > 0.25) irA(plc, 'MARCA_SUBE')
      break
    case 'MARCA_SUBE': // el marcador regresa por resorte
      s.yC = false
      if (plc.t > 0.4) irA(plc, 'SUELTA')
      break
    case 'SUELTA':
      s.yB = false
      if (s.b0) irA(plc, 'A_TOMA')
      break
    case 'A_TOMA': // LS-4 avisa que la pieza llego al tope
      s.motorBanda = !s.ls4
      if (s.ls4 && s.si2 && s.z0) irA(plc, 'Z_BAJA')
      break
    case 'Z_BAJA':
      s.motorBanda = false
      s.yZ = true
      if (s.z1) irA(plc, 'CIERRA')
      break
    case 'CIERRA':
      s.yG = true
      if (plc.t > 0.3) irA(plc, 'Z_SUBE')
      break
    case 'Z_SUBE':
      s.yZ = false
      if (s.z0) {
        // alterna entre los dos carriles de cada material
        s.posX =
          s.material === 'al'
            ? 3 + (plc.aluminio++ % 2)
            : 1 + (plc.plastico++ % 2)
        irA(plc, 'X_IR')
      }
      break
    case 'X_IR': // espera a que el carro llegue y a que haya caja lista
      if (
        plc.t > 0.1 &&
        s.xOk &&
        cajas[s.material === 'al' ? 1 : 0].estado === 'llenando'
      )
        irA(plc, 'Z_BAJA2')
      break
    case 'Z_BAJA2':
      s.yZ = true
      if (s.z1) irA(plc, 'ABRE')
      break
    case 'ABRE':
      s.yG = false
      if (plc.t > 0.3) {
        if (s.material === 'al') s.piezasAl++
        else s.piezasPl++
        irA(plc, 'Z_SUBE2')
      }
      break
    case 'Z_SUBE2':
      s.yZ = false
      if (s.z0) {
        s.tCiclo = plc.reloj - plc.inicioCiclo
        s.posX = 0
        if (s.marcha) empezarCiclo(plc)
        else irA(plc, 'VUELVE')
      }
      break
    case 'VUELVE':
      if (plc.t > 0.1 && s.xOk) irA(plc, 'REPOSO')
      break
    case 'EMERGENCIA': // espera a que alguien restablezca
      break
  }

  const paso = PASO[plc.estado] ?? 0
  s.paso = paso
  s.torreVerde = paso > 0
  s.torreAmarilla = paso === 0
  s.torreRoja = false
}
