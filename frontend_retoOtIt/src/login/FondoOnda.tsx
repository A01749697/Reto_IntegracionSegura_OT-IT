// Cuadricula diagonal cuyas lineas ondulan. Se calcula una sola vez al cargar.
const ANCHO = 1440
const ALTO = 920
const LIMITE = { x0: -140, x1: 1580, y0: -140, y1: 1060 }
const PASO = 34
const SEPARACION = 80

type Punto = [number, number]

function deformar(x: number, y: number): Punto {
  const amplitud = 12 + 24 * Math.max(0, Math.min(1, y / ALTO))
  return [
    x + amplitud * 1.2 * Math.sin(y * 0.011 + x * 0.0045),
    y + amplitud * Math.sin(x * 0.009 - y * 0.003),
  ]
}

function trazar(puntos: Punto[]): string {
  const tramos: string[] = []
  let actual: string[] = []
  const cerrar = () => {
    if (actual.length > 1) tramos.push('M' + actual.join(' L'))
    actual = []
  }
  for (const [x, y] of puntos) {
    const [px, py] = deformar(x, y)
    const dentro =
      px >= LIMITE.x0 && px <= LIMITE.x1 && py >= LIMITE.y0 && py <= LIMITE.y1
    if (dentro) actual.push(`${Math.round(px)} ${Math.round(py)}`)
    else cerrar()
  }
  cerrar()
  return tramos.join(' ')
}

function crearMalla() {
  const xs: number[] = []
  for (let x = LIMITE.x0 - 200; x < LIMITE.x1 + 200; x += PASO) xs.push(x)

  const normales: string[] = []
  const turquesa: string[] = []
  let indice = 0
  for (let c = -1500; c < 1700; c += SEPARACION) {
    const d = trazar(xs.map((x): Punto => [x, x - c]))
    if (d) (indice % 7 === 3 ? turquesa : normales).push(d)
    indice += 1
  }
  for (let c = -300; c < 3000; c += SEPARACION) {
    const d = trazar(xs.map((x): Punto => [x, c - x]))
    if (d) normales.push(d)
  }
  return { normales: normales.join(' '), turquesa: turquesa.join(' ') }
}

const MALLA = crearMalla()

export default function FondoOnda() {
  return (
    <svg
      viewBox={`0 0 ${ANCHO} ${ALTO}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <path
        d={MALLA.normales}
        fill="none"
        stroke="#1f5fd0"
        strokeOpacity={0.17}
        strokeWidth={1.1}
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={MALLA.turquesa}
        fill="none"
        stroke="#0fa3a3"
        strokeOpacity={0.38}
        strokeWidth={1.4}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
