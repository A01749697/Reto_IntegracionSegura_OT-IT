// Las lecturas reales del servidor: disco, memoria, procesador, certificado y API receptora.
// Todo es de solo lectura. El servicio las recibe desde afuera para poder probarlo con datos falsos.
import { X509Certificate } from 'node:crypto'
import { readFile, statfs } from 'node:fs/promises'
import os from 'node:os'
import { interpretarMeminfo, redondear, type Memoria } from './recursos'

export type Disco = { totalBytes: number; usadoBytes: number }

export type Cpu = {
  nucleos: number
  carga1: number
  carga5: number
  carga15: number
}

// Mismo cálculo que "df": usado sobre (usado + disponible).
export async function leerDisco(ruta = '/'): Promise<Disco> {
  const datos = await statfs(ruta)
  const bloque = Number(datos.bsize)
  const usado = (Number(datos.blocks) - Number(datos.bfree)) * bloque
  const disponible = Number(datos.bavail) * bloque
  const total = usado + disponible
  if (!Number.isFinite(total) || total <= 0) {
    throw new Error('El disco no devolvió un tamaño válido')
  }
  return { totalBytes: total, usadoBytes: usado }
}

export async function leerMemoria(ruta = '/proc/meminfo'): Promise<Memoria> {
  const memoria = interpretarMeminfo(await readFile(ruta, 'utf8'))
  if (!memoria) throw new Error('No se pudo interpretar la memoria')
  return memoria
}

// La carga es el promedio de procesos esperando turno (1, 5 y 15 minutos).
// Con un solo núcleo, una carga sostenida arriba de 1 quiere decir que anda corto.
export function leerCpu(): Cpu {
  const [carga1 = 0, carga5 = 0, carga15 = 0] = os.loadavg()
  return {
    nucleos: os.availableParallelism(),
    carga1: redondear(carga1),
    carga5: redondear(carga5),
    carga15: redondear(carga15),
  }
}

// Lee el certificado público de nginx (un archivo montado en solo lectura) y regresa cuándo vence.
// No se conecta a nadie ni toca la llave privada.
export async function leerVencimientoCertificado(ruta: string): Promise<Date> {
  const vence = new X509Certificate(await readFile(ruta)).validToDate
  if (Number.isNaN(vence.getTime())) {
    throw new Error('El certificado no trae una fecha de vencimiento válida')
  }
  return vence
}

export async function comprobarApiReceptora(
  url: string,
  esperaMs: number,
): Promise<void> {
  const respuesta = await fetch(`${url}/api/ingest/salud`, {
    signal: AbortSignal.timeout(esperaMs),
    redirect: 'error',
  })
  if (!respuesta.ok) {
    throw new Error(`La API receptora respondió ${respuesta.status}`)
  }
  const cuerpo: unknown = await respuesta.json()
  const estado =
    typeof cuerpo === 'object' && cuerpo !== null && 'estado' in cuerpo
      ? cuerpo.estado
      : undefined
  if (estado !== 'ok') throw new Error('La API receptora no dijo ok')
}
