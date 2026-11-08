// Cuatro colores, uno por zona, de la planta a la nube.
export default function FranjaZonas() {
  return (
    <div className="flex h-1.5" aria-hidden="true">
      <i className="block flex-1 bg-zona-ot" />
      <i className="block flex-1 bg-zona-idmz" />
      <i className="block flex-1 bg-zona-it" />
      <i className="block flex-1 bg-zona-nube" />
    </div>
  )
}
