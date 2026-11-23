// Convierte lo que se lee del servidor en números limpios.
// Son funciones puras: no leen nada del sistema, por eso se prueban fácil.

export type Memoria = {
  totalBytes: number
  disponibleBytes: number
  swapTotalBytes: number
  swapUsadoBytes: number
}

const KIB = 1024
const DIA_MS = 24 * 60 * 60 * 1000

const LINEA_MEMINFO = /^([A-Za-z0-9_()]+):\s+(\d+)(?:\s+(kB))?\s*$/

// /proc/meminfo trae líneas como "MemTotal:        2035556 kB".
// Si falta algo o los números no cuadran, regresa null y no se inventa nada.
export function interpretarMeminfo(texto: string): Memoria | null {
  const valores = new Map<string, number>()
  for (const linea of texto.split('\n')) {
    const partes = LINEA_MEMINFO.exec(linea)
    const nombre = partes?.[1]
    const cantidad = partes?.[2]
    if (!nombre || !cantidad) continue
    valores.set(nombre, Number(cantidad) * (partes?.[3] === 'kB' ? KIB : 1))
  }

  const total = valores.get('MemTotal')
  const disponible = valores.get('MemAvailable')
  const swapTotal = valores.get('SwapTotal')
  const swapLibre = valores.get('SwapFree')
  if (
    total === undefined ||
    disponible === undefined ||
    swapTotal === undefined ||
    swapLibre === undefined
  ) {
    return null
  }
  if (total <= 0 || disponible > total || swapLibre > swapTotal) return null

  return {
    totalBytes: total,
    disponibleBytes: disponible,
    swapTotalBytes: swapTotal,
    swapUsadoBytes: swapTotal - swapLibre,
  }
}

// Días completos que faltan para una fecha. Si ya pasó, sale negativo.
export function diasRestantes(vence: Date, ahora: number): number {
  return Math.floor((vence.getTime() - ahora) / DIA_MS)
}

export function redondear(numero: number, decimales = 2): number {
  const factor = 10 ** decimales
  return Math.round(numero * factor) / factor
}
