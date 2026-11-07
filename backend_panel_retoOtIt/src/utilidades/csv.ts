// Arma un archivo CSV que Excel abre bien (UTF-8 con BOM, saltos de línea de Windows).
type Celda = string | number | null

// la marca del inicio le avisa a Excel que el archivo es UTF-8
const MARCA_UTF8 = String.fromCharCode(0xfeff)

// Una celda que empieza con = + - @ Excel la tomaría como fórmula; se le antepone una comilla.
function escapar(valor: Celda): string {
  let texto = valor === null ? '' : String(valor)
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`
  return /[",\r\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto
}

export function aCsv(encabezados: string[], filas: Celda[][]): string {
  const lineas = [encabezados, ...filas].map((fila) =>
    fila.map(escapar).join(','),
  )
  return `${MARCA_UTF8}${lineas.join('\r\n')}\r\n`
}
