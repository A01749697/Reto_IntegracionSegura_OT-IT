import { region } from './tiempo'

const UNIDADES = ['B', 'KB', 'MB', 'GB', 'TB']

// Un tamaño legible, como "512 MB" o "1.9 GB". Usa potencias de 1024.
export function bytes(cantidad: number): string {
  let valor = Math.max(0, cantidad)
  let unidad = 0
  while (valor >= 1024 && unidad < UNIDADES.length - 1) {
    valor /= 1024
    unidad += 1
  }
  const numero = valor.toLocaleString(region(), {
    maximumFractionDigits: unidad === 0 ? 0 : 1,
  })
  return `${numero} ${UNIDADES[unidad]}`
}

// Porcentaje entero de una parte sobre su total, entre 0 y 100.
export function porcentaje(parte: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((parte / total) * 100)))
}
