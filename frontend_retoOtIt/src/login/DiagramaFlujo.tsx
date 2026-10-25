import { Cloud, Database, Laptop, Microchip, ShieldLock } from 'reicon-react'
import type { IconComponent } from 'reicon-react/createIcon'

type Nodo = {
  zona: string
  titulo: string
  Icono: IconComponent
  contenedor: string
  icono: string
  etiqueta: string
}

// De la planta (azul mas oscuro) a la nube (blanco).
const NODOS: Nodo[] = [
  {
    zona: 'OT',
    titulo: 'PLC S7-1200 / S7-1500',
    Icono: Microchip,
    contenedor:
      'border-l-[6px] border-azul-it bg-azul-ot text-white shadow-[0_4px_12px_rgba(11,47,107,0.25)]',
    icono: 'text-azul-claro',
    etiqueta: 'bg-azul-claro text-azul-ot',
  },
  {
    zona: 'IDMZ',
    titulo: 'Colector e historian',
    Icono: Database,
    contenedor:
      'bg-azul-idmz text-white shadow-[0_4px_12px_rgba(31,95,208,0.25)]',
    icono: 'text-white',
    etiqueta: 'bg-white text-azul-idmz',
  },
  {
    zona: 'IT',
    titulo: 'Agente de datos',
    Icono: Laptop,
    contenedor:
      'bg-azul-it text-azul-marino shadow-[0_4px_12px_rgba(31,95,208,0.2)]',
    icono: 'text-azul-marino',
    etiqueta: 'bg-azul-marino text-white',
  },
  {
    zona: 'NUBE',
    titulo: 'API y panel en AWS',
    Icono: Cloud,
    contenedor:
      'border-2 border-azul-it bg-white text-tinta shadow-[0_4px_12px_rgba(31,95,208,0.12)]',
    icono: 'text-azul-idmz',
    etiqueta: 'border-[1.5px] border-[#174ea6] text-[#174ea6]',
  },
]

// Firewall y protocolo que hay entre cada par de zonas.
const CONEXIONES = [
  'Firewall OT–IDMZ · OPC UA 4840',
  'Firewall IDMZ–IT · PostgreSQL TLS 5432',
  'FireIT-NUBE · HTTPS 443',
]

function Conexion({ texto }: { texto: string }) {
  return (
    <div className="ml-[30px] flex h-[54px] items-center gap-3.5">
      <svg width="4" height="54" viewBox="0 0 4 54" aria-hidden="true">
        <line
          x1="2"
          y1="0"
          x2="2"
          y2="54"
          strokeWidth="3"
          strokeDasharray="5 5"
          className="animate-flujo stroke-turquesa motion-reduce:animate-none"
        />
      </svg>
      <span className="flex items-center gap-2 rounded-full border border-azul-it bg-white px-3 py-[5px] font-mono text-[13px] font-medium text-tinta">
        <ShieldLock
          size={15}
          aria-hidden="true"
          className="text-turquesa-oscuro"
        />
        {texto}
      </span>
    </div>
  )
}

export default function DiagramaFlujo() {
  return (
    <div
      role="img"
      aria-label="Flujo de datos de la planta a la nube: PLC en zona OT, colector e historian en la IDMZ, agente de datos en zona IT y panel en la nube"
      className="mt-1.5 flex flex-col"
    >
      {NODOS.map(({ zona, titulo, Icono, contenedor, icono, etiqueta }, i) => (
        <div key={zona}>
          {i > 0 && <Conexion texto={CONEXIONES[i - 1]} />}
          <div
            className={`flex items-center gap-3.5 rounded-[10px] px-[18px] py-4 ${contenedor}`}
          >
            <Icono size={26} aria-hidden="true" className={icono} />
            <span className="grow text-[17px] font-semibold">{titulo}</span>
            <span
              className={`rounded-md px-2.5 py-[3px] font-mono text-[13px] font-semibold tracking-wider ${etiqueta}`}
            >
              {zona}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
